import {
	BadRequestException,
	ConflictException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Readable } from 'stream';
import { VideoResponseDto } from '../../dto/base-video.dto';
import { ChunkUploadService } from '../../services/chunk-upload.service';
import { VideoStorageService } from '../../services/video-storage.service';
import { sha256File } from '../../utils/sha-256-file';
import { VideoRepository } from '../../video.repoistory';
import { hasConflictingOverlap } from '../../utils/has-conflicting-overlap';
import { isRangeAlreadyCovered } from '../../utils/is-range-already-covered';
import { calcOffsetFromRanges } from '../../utils/calc-offset-from-ranges';
import { mergeRanges } from '../../utils/merge-ranges';
import { UploadedRange } from '../../video.entity';

type ExecuteInput = {
	userId: string;
	sessionId?: string;
	stream: Readable;
	chunk: {
		range: { start: number; end: number };
		totalSize: number;
		length: number;
		chunkSize?: number;
	};
	formParsePromise: Promise<any>;
	filename: string;
	mimeType: string;
};

type ExecuteResult = {
	sessionId: string;
	offset: number;
	totalSize: number;
	isComplete: boolean;
	location?: string;
	video?: VideoResponseDto;
};

const DEFAULT_TMP_DIR = path.resolve(process.cwd(), 'data', 'tmp');

@Injectable()
export class UploadVideoUsecase {
	constructor(
		private readonly chunks: ChunkUploadService,
		private readonly storage: VideoStorageService,
		private readonly videoRepo: VideoRepository,
	) {}

	async execute(input: ExecuteInput): Promise<ExecuteResult> {
		// 1) Создать или найти сессию (в БД это запись video)
		let videoId = input.sessionId;
		if (!videoId) {
			const { id } = await this.videoRepo.save({
				user_id: input.userId,
				filename: input.filename,
				mime_type: input.mimeType,
				total_size: String(input.chunk.totalSize),
				chunk_size: String(
					input.chunk.chunkSize ?? Math.min(64 * 1024 * 1024, Math.max(1 * 1024 * 1024, input.chunk.length)),
				),
				tmp_path: this.allocateTmpPath(),
				phase: 'receiving',
			});
			videoId = id;
		}

		let video = await this.videoRepo.findById(videoId);
		if (!video) throw new BadRequestException('Video upload not found');

		if (video.total_size !== String(input.chunk.totalSize)) {
			throw new BadRequestException('Total size mismatch');
		}

		const { start, end } = input.chunk.range;

		if (isRangeAlreadyCovered(video.uploaded_ranges, start, end)) {
			const nextOffset = calcOffsetFromRanges(video.uploaded_ranges);
			return {
				sessionId: videoId,
				offset: nextOffset,
				totalSize: Number(video.total_size),
				isComplete: String(nextOffset) === video.total_size,
				location: `/videos/uploads/${videoId}`,
			};
		}

		// 3) Запрет конфликтующих частичных перекрытий
		if (hasConflictingOverlap(video.uploaded_ranges, start, end)) {
			throw new ConflictException('Range overlaps existing data');
		}

		// 4) Фактическая запись чанка в файл (без БД-вызовов)
		await this.chunks.writeChunkAt({
			body: input.stream,
			tmpPath: video.tmp_path,
			start,
			end,
			totalSize: Number(video.total_size),
			length: input.chunk.length,
		});

		const merged: UploadedRange[] = mergeRanges([...video.uploaded_ranges, { start, end }]);
		const nextOffset = calcOffsetFromRanges(merged);
		video = await this.videoRepo.advanceProgress(video.id, nextOffset, merged);

		const base: ExecuteResult = {
			sessionId: videoId,
			offset: Number(video.upload_offset),
			totalSize: Number(video.total_size),
			isComplete: video.upload_offset === video.total_size,
			location: `/videos/uploads/${videoId}`,
		};

		if (!base.isComplete) return base;

		// 6) Пост-обработка: hashing -> upload S3 -> завершение
		await this.videoRepo.setPhase(videoId, 'hashing');

		const fresh = await this.videoRepo.findById(videoId);
		if (!fresh) throw new NotFoundException('Upload session lost');

		const sha256 = await sha256File(fresh.tmp_path);
		await this.videoRepo.setChecksum(videoId, sha256);

		await this.videoRepo.setPhase(videoId, 'uploading_s3');

		const storeRes = await this.storage.uploadLocalFile({
			localPath: fresh.tmp_path,
			filename: fresh.filename,
			contentType: fresh.mime_type ?? 'application/octet-stream',
			contentLength: Number(fresh.total_size),
			checksumBase64: sha256,
			metadata: { userId: fresh.user_id },
		});

		const updated = await this.videoRepo.update(videoId, {
			user_id: fresh.user_id,
			filename: fresh.filename,
			mime_type: fresh.mime_type,
			total_size: fresh.total_size,
			storage_key: storeRes.storageKey,
			checksum_sha256_base64: sha256,
		});

		if (!updated) {
			throw new InternalServerErrorException('Video is being uploaded by another request');
		}

		try {
			fs.unlinkSync(fresh.tmp_path);
		} catch {
			return {
				...base,
				isComplete: true,
				video: updated as unknown as VideoResponseDto,
				location: `/videos/${updated.id}`,
			};
		}

		await this.videoRepo.setPhase(videoId, 'completed');

		return {
			...base,
			isComplete: true,
			video: updated as unknown as VideoResponseDto,
			location: `/videos/${updated.id}`,
		};
	}

	/**
	 * Статус теперь — ответственность usecase/репозитория, а не файлового сервиса.
	 */
	async getStatus(sessionId: string) {
		const s = await this.videoRepo.findById(sessionId);
		if (!s) throw new NotFoundException('Upload session not found');
		return {
			sessionId: s.id,
			phase: s.phase,
			offset: s.upload_offset,
			total_size: s.total_size,
			ranges: s.uploaded_ranges,
		};
	}

	private allocateTmpPath(): string {
		const baseDir = process.env.VIDEO_UPLOAD_TMP_DIR || DEFAULT_TMP_DIR;
		fs.mkdirSync(baseDir, { recursive: true });
		const p = path.join(baseDir, `${crypto.randomUUID()}.part`);
		fs.closeSync(fs.openSync(p, 'w'));
		return p;
	}
}
