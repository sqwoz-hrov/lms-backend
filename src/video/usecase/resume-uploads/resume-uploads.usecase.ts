import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import { sha256File } from '../../utils/sha-256-file';
import { Video } from '../../video.entity';
import { VideoRepository } from '../../video.repoistory';
import { VideoStorageService } from '../../services/video-storage.service';
import { calcOffsetFromRanges } from '../../utils/calc-offset-from-ranges';
import { ensureGzipTmpPath } from '../../utils/ensure-gzip-tmp-path';
import { compressToGzip } from '../../utils/compress-to-gzip';

@Injectable()
export class ResumeUploadsUsecase implements OnModuleInit {
	private readonly logger = new Logger(ResumeUploadsUsecase.name);

	constructor(
		private readonly videoRepo: VideoRepository,
		private readonly storage: VideoStorageService,
	) {}

	onModuleInit(): void {
		this.resumeAllStuck().catch(err => {
			this.logger.error('Failed to kick off resumeAllStuck()', err?.stack || String(err));
		});
	}

	private async resumeAllStuck(): Promise<void> {
		const hashing = await this.videoRepo.find({ phase: 'hashing' });
		const compressing = await this.videoRepo.find({ phase: 'compressing' });
		const uploading = await this.videoRepo.find({ phase: 'uploading_s3' });
		const stuck = [...hashing, ...compressing, ...uploading];

		if (!stuck.length) {
			this.logger.log('No stuck uploads to resume.');
			return;
		}

		this.logger.log(`Resuming ${stuck.length} stuck upload(s)...`);

		const parallel = 2;
		const queue = [...stuck];
		const workers = Array.from({ length: parallel }, () => this.worker(queue));

		await Promise.allSettled(workers);
		this.logger.log('Resume pass finished.');
	}

	private async worker(queue: Video[]): Promise<void> {
		for (;;) {
			const next = queue.pop();
			if (!next) return;

			try {
				await this.resumeOne(next);
			} catch (err) {
				this.logger.error(`Resume failed for video ${next.id} (phase=${next.phase})`, err?.stack || String(err));
			}
		}
	}

	private async resumeOne(video: Video): Promise<void> {
		const offset = calcOffsetFromRanges(video.uploaded_ranges);
		const total = Number(video.total_size);
		if (offset !== total) {
			this.logger.warn(`Video ${video.id} is not fully received (offset=${offset}, total=${total}). Skipping.`);
			return;
		}

		if (video.phase === 'hashing') {
			await this.hashCompressAndUpload(video);
			return;
		}

		if (video.phase === 'compressing') {
			await this.compressAndUpload(video);
			return;
		}

		if (video.phase === 'uploading_s3') {
			await this.ensureUploaded(video);
			return;
		}

		this.logger.debug(`Video ${video.id} not in a resumable phase (${video.phase}). Skipping.`);
	}

	private async hashCompressAndUpload(video: Video): Promise<void> {
		if (!video.tmp_path || !fs.existsSync(video.tmp_path)) {
			this.logger.warn(`Missing tmp file for video ${video.id} in 'hashing' phase. Marking failed.`);
			await this.videoRepo.setPhase(video.id, 'failed');
			return;
		}

		const sha256 = await sha256File(video.tmp_path);
		await this.videoRepo.setChecksum(video.id, sha256);
		await this.videoRepo.setPhase(video.id, 'compressing');

		const gzPath = await ensureGzipTmpPath(video.gzip_tmp_path, async newPath => {
			await this.videoRepo.update(video.id, { gzip_tmp_path: newPath });
		});
		const gzSize = await compressToGzip(video.tmp_path, gzPath);

		await this.videoRepo.setPhase(video.id, 'uploading_s3');

		const storeRes = await this.storage.findOrUploadByChecksum({
			localPath: gzPath,
			filename: video.filename,
			contentType: video.mime_type ?? 'application/octet-stream',
			contentLength: gzSize,
			checksumBase64: sha256,
			metadata: { userId: video.user_id },
		});

		const updated = await this.videoRepo.update(video.id, {
			user_id: video.user_id,
			filename: video.filename,
			mime_type: video.mime_type,
			total_size: video.total_size,
			storage_key: storeRes.storageKey,
			checksum_sha256_base64: sha256,
		});
		if (!updated) {
			this.logger.error(`Concurrent update race for video ${video.id} while resuming upload.`);
			return;
		}

		if (video.tmp_path) fs.unlinkSync(video.tmp_path);
		if (gzPath) fs.unlinkSync(gzPath);

		await this.videoRepo.setPhase(video.id, 'completed');
		this.logger.log(`Video ${video.id} resumed and completed.`);
	}

	private async compressAndUpload(video: Video): Promise<void> {
		if (!video.tmp_path || !fs.existsSync(video.tmp_path)) {
			this.logger.warn(`Missing tmp file for video ${video.id} in 'compressing' phase. Marking failed.`);
			await this.videoRepo.setPhase(video.id, 'failed');
			return;
		}

		let checksum = video.checksum_sha256_base64;
		if (!checksum) {
			checksum = await sha256File(video.tmp_path);
			await this.videoRepo.setChecksum(video.id, checksum);
		}

		const gzPath = await ensureGzipTmpPath(video.gzip_tmp_path, async newPath => {
			await this.videoRepo.update(video.id, { gzip_tmp_path: newPath });
		});
		const gzSize = await compressToGzip(video.tmp_path, gzPath);

		await this.videoRepo.setPhase(video.id, 'uploading_s3');

		const storeRes = await this.storage.findOrUploadByChecksum({
			localPath: gzPath,
			filename: video.filename,
			contentType: video.mime_type ?? 'application/octet-stream',
			contentLength: gzSize,
			checksumBase64: checksum,
			metadata: { userId: video.user_id },
		});

		const updated = await this.videoRepo.update(video.id, {
			user_id: video.user_id,
			filename: video.filename,
			mime_type: video.mime_type,
			total_size: video.total_size,
			storage_key: storeRes.storageKey,
			checksum_sha256_base64: checksum,
		});
		if (!updated) {
			this.logger.error(`Concurrent update race for video ${video.id} while finalizing upload.`);
			return;
		}

		if (video.tmp_path) fs.unlinkSync(video.tmp_path);
		if (gzPath) fs.unlinkSync(gzPath);

		await this.videoRepo.setPhase(video.id, 'completed');
		this.logger.log(`Video ${video.id} completed from 'compressing'.`);
	}

	private async ensureUploaded(video: Video): Promise<void> {
		if (video.storage_key) {
			if (video.tmp_path) fs.unlinkSync(video.tmp_path);
			if (video.gzip_tmp_path) fs.unlinkSync(video.gzip_tmp_path);
			await this.videoRepo.setPhase(video.id, 'completed');
			this.logger.log(`Video ${video.id} already has storage_key; marked completed.`);
			return;
		}

		const tmpExists = !!video.tmp_path && fs.existsSync(video.tmp_path);
		const gzExists = !!video.gzip_tmp_path && fs.existsSync(video.gzip_tmp_path);
		let checksum = video.checksum_sha256_base64;

		if (!tmpExists && !gzExists && !checksum) {
			this.logger.warn(`Video ${video.id} in 'uploading_s3' without tmp/gzip or checksum. Marking failed.`);
			await this.videoRepo.setPhase(video.id, 'failed');
			return;
		}

		if (!checksum && tmpExists) {
			checksum = await sha256File(video.tmp_path);
			await this.videoRepo.setChecksum(video.id, checksum);
		}

		let gzPath = video.gzip_tmp_path;
		let gzSize: number | undefined;

		if (gzExists) {
			gzSize = fs.statSync(gzPath).size;
		} else if (tmpExists) {
			gzPath = await ensureGzipTmpPath(video.gzip_tmp_path, async newPath => {
				await this.videoRepo.update(video.id, { gzip_tmp_path: newPath });
			});
			gzSize = await compressToGzip(video.tmp_path, gzPath);
		} else {
			this.logger.warn(`Video ${video.id} has no source to (re)create gzip. Marking failed.`);
			await this.videoRepo.setPhase(video.id, 'failed');
			return;
		}

		const storeRes = await this.storage.findOrUploadByChecksum({
			localPath: gzPath,
			filename: video.filename,
			contentType: video.mime_type ?? 'application/octet-stream',
			contentLength: gzSize,
			checksumBase64: checksum!,
			metadata: { userId: video.user_id },
		});

		const updated = await this.videoRepo.update(video.id, {
			user_id: video.user_id,
			filename: video.filename,
			mime_type: video.mime_type,
			total_size: video.total_size,
			storage_key: storeRes.storageKey,
			checksum_sha256_base64: checksum!,
		});
		if (!updated) {
			this.logger.error(`Concurrent update race for video ${video.id} while finalizing upload.`);
			return;
		}

		if (video.tmp_path) fs.unlinkSync(video.tmp_path);
		if (gzPath) fs.unlinkSync(gzPath);

		await this.videoRepo.setPhase(video.id, 'completed');
		this.logger.log(`Video ${video.id} finalized and completed from 'uploading_s3'.`);
	}
}
