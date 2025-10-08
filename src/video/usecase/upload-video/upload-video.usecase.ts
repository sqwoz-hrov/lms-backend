import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Readable } from 'stream';
import { ChunkUploadService } from '../../services/chunk-upload.service';
import { VideoRepository } from '../../video.repoistory';
import { calcOffsetFromRanges } from '../../utils/calc-offset-from-ranges';
import { hasConflictingOverlap } from '../../utils/has-conflicting-overlap';
import { isRangeAlreadyCovered } from '../../utils/is-range-already-covered';
import { mergeRanges } from '../../utils/merge-ranges';
import { allocateTmpPath } from '../../utils/allocate-tmp-path';
import type { UploadedRange, Video } from '../../video.entity';
import { WorkflowRunnerService } from '../../services/workflow-runner.service';
import type { VideoResponseDto } from '../../dto/base-video.dto';

export type UploadExecuteInput = {
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
};

export type UploadExecuteResult = {
	sessionId: string;
	offset: number;
	totalSize: number;
	isComplete: boolean;
	location?: string;
	video?: VideoResponseDto;
};

@Injectable()
export class UploadVideoUsecase {
	private readonly logger = new Logger(UploadVideoUsecase.name);

	constructor(
		private readonly chunks: ChunkUploadService,
		private readonly videoRepo: VideoRepository,
		private readonly runner: WorkflowRunnerService,
	) {}

	async execute(input: UploadExecuteInput): Promise<UploadExecuteResult> {
		let videoId = input.sessionId;

		if (!videoId) {
			const tmpPath = allocateTmpPath();
			const chunkSize = String(
				input.chunk.chunkSize ?? Math.min(64 * 1024 * 1024, Math.max(1 * 1024 * 1024, input.chunk.length)),
			);

			const created = await this.videoRepo.save({
				user_id: input.userId,
				filename: input.filename,
				total_size: String(input.chunk.totalSize),
				chunk_size: chunkSize,
				tmp_path: tmpPath,
				phase: 'receiving',
			});
			videoId = created.id;
		}

		let video = await this.videoRepo.findById(videoId);
		if (!video) throw new BadRequestException('Video upload not found');

		if (video.total_size !== String(input.chunk.totalSize)) {
			throw new BadRequestException('Total size mismatch');
		}

		const { start, end } = input.chunk.range;

		if (isRangeAlreadyCovered(video.uploaded_ranges, start, end)) {
			const nextOffset = calcOffsetFromRanges(video.uploaded_ranges);
			const base = this.baseResult(videoId, video, nextOffset);
			if (base.isComplete) this.safeAdvance(videoId);
			return base;
		}

		if (hasConflictingOverlap(video.uploaded_ranges, start, end)) {
			throw new ConflictException('Range overlaps existing data');
		}

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

		const base = this.baseResult(videoId, video, nextOffset);

		if (base.isComplete) {
			this.safeAdvance(videoId);
			const fresh = await this.videoRepo.findById(videoId);
			return {
				...base,
				video: fresh,
				location: fresh?.phase === 'completed' ? `/videos/${videoId}` : `/videos/uploads/${videoId}`,
			};
		}

		return base;
	}

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

	private baseResult(videoId: string, video: Video, nextOffset: number): UploadExecuteResult {
		return {
			sessionId: videoId,
			offset: nextOffset,
			totalSize: Number(video.total_size),
			isComplete: String(nextOffset) === video.total_size,
			location: `/videos/uploads/${videoId}`,
		};
	}

	private safeAdvance(videoId: string) {
		this.runner.advance(videoId).catch(e => {
			this.logger.error(`advance() failed for ${videoId}: ${(e as Error).message}`);
		});
	}
}
