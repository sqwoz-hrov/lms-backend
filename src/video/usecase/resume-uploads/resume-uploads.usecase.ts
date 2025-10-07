import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import { sha256File } from '../../utils/sha-256-file';
import { Video } from '../../video.entity';
import { VideoRepository } from '../../video.repoistory';
import { VideoStorageService } from '../../services/video-storage.service';
import { calcOffsetFromRanges } from '../../utils/calc-offset-from-ranges';
import { detectVideoMime } from '../../utils/detect-video-mimetype';
import { ensureFilenameExt } from '../../utils/ensure-filename-extension';

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
		const uploading = await this.videoRepo.find({ phase: 'uploading_s3' });
		const stuck = [...hashing, ...uploading];

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
			await this.hashAndUpload(video);
			return;
		}

		if (video.phase === 'uploading_s3') {
			await this.ensureUploaded(video);
			return;
		}

		this.logger.debug(`Video ${video.id} not in a resumable phase (${video.phase}). Skipping.`);
	}

	private async hashAndUpload(video: Video): Promise<void> {
		if (!video.tmp_path || !fs.existsSync(video.tmp_path)) {
			this.logger.warn(`Missing tmp file for video ${video.id} in 'hashing' phase. Marking failed.`);
			await this.videoRepo.setPhase(video.id, 'failed');
			return;
		}

		const checksum = await sha256File(video.tmp_path);
		await this.videoRepo.setChecksum(video.id, checksum);
		await this.videoRepo.setPhase(video.id, 'uploading_s3');

		const { finalMime, finalFilename, freshVideo } = await this.resolveFinalMimeAndFilename(video, video.tmp_path);

		const size = fs.statSync(video.tmp_path).size;

		const storeRes = await this.storage.findOrUploadByChecksum({
			localPath: video.tmp_path,
			filename: finalFilename,
			contentType: finalMime,
			contentLength: size,
			checksumBase64: checksum,
			metadata: { userId: freshVideo.user_id },
		});

		const updated = await this.videoRepo.update(freshVideo.id, {
			user_id: freshVideo.user_id,
			filename: finalFilename,
			mime_type: finalMime,
			total_size: freshVideo.total_size,
			storage_key: storeRes.storageKey,
			checksum_sha256_base64: checksum,
		});
		if (!updated) {
			this.logger.error(`Concurrent update race for video ${freshVideo.id} while resuming upload.`);
			return;
		}

		if (freshVideo.tmp_path) fs.unlinkSync(freshVideo.tmp_path);

		await this.videoRepo.setPhase(freshVideo.id, 'completed');
		this.logger.log(`Video ${freshVideo.id} resumed and completed.`);
	}

	private async ensureUploaded(video: Video): Promise<void> {
		if (video.storage_key) {
			if (video.tmp_path) fs.unlinkSync(video.tmp_path);
			await this.videoRepo.setPhase(video.id, 'completed');
			this.logger.log(`Video ${video.id} already has storage_key; marked completed.`);
			return;
		}

		const tmpExists = !!video.tmp_path && fs.existsSync(video.tmp_path);
		if (!tmpExists) {
			this.logger.warn(`Video ${video.id} in 'uploading_s3' without tmp file. Marking failed.`);
			await this.videoRepo.setPhase(video.id, 'failed');
			return;
		}

		let checksum = video.checksum_sha256_base64;
		if (!checksum) {
			checksum = await sha256File(video.tmp_path);
			await this.videoRepo.setChecksum(video.id, checksum);
		}

		const { finalMime, finalFilename, freshVideo } = await this.resolveFinalMimeAndFilename(video, video.tmp_path);

		const size = fs.statSync(video.tmp_path).size;

		const storeRes = await this.storage.findOrUploadByChecksum({
			localPath: video.tmp_path,
			filename: finalFilename,
			contentType: finalMime,
			contentLength: size,
			checksumBase64: checksum,
			metadata: { userId: freshVideo.user_id },
		});

		const updated = await this.videoRepo.update(freshVideo.id, {
			user_id: freshVideo.user_id,
			filename: finalFilename,
			mime_type: finalMime,
			total_size: freshVideo.total_size,
			storage_key: storeRes.storageKey,
			checksum_sha256_base64: checksum,
		});
		if (!updated) {
			this.logger.error(`Concurrent update race for video ${freshVideo.id} while finalizing upload.`);
			return;
		}

		if (freshVideo.tmp_path) fs.unlinkSync(freshVideo.tmp_path);

		await this.videoRepo.setPhase(freshVideo.id, 'completed');
		this.logger.log(`Video ${freshVideo.id} finalized and completed from 'uploading_s3'.`);
	}

	private async resolveFinalMimeAndFilename(
		video: Video,
		localPath: string,
	): Promise<{
		finalMime: string;
		finalFilename: string;
		freshVideo: Video;
	}> {
		const detected = await detectVideoMime(localPath); // null | { mime, ext }
		const desiredMime = detected?.mime ?? (video.mime_type || 'application/octet-stream');
		const desiredFilename = detected?.ext ? ensureFilenameExt(video.filename, detected.ext) : video.filename;

		const mimeChanged = desiredMime !== (video.mime_type || '');
		const nameChanged = desiredFilename !== video.filename;

		if (mimeChanged || nameChanged) {
			const ok = await this.videoRepo.update(video.id, {
				user_id: video.user_id,
				filename: desiredFilename,
				mime_type: desiredMime,
				total_size: video.total_size,
			});
			if (!ok) {
				this.logger.warn(`Lost update while normalizing mime/filename for video ${video.id}; reloading row.`);
			}
		}

		const fresh = (await this.videoRepo.findById(video.id)) || video;

		return {
			finalMime: desiredMime,
			finalFilename: desiredFilename,
			freshVideo: fresh,
		};
	}
}
