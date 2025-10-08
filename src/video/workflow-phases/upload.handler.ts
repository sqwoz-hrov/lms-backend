import type { PhaseHandler, PhaseHandleResult } from '../ports/phase-handler';
import type { Video } from '../video.entity';
import * as fs from 'fs';
import { detectVideoMime } from '../utils/detect-video-mimetype';
import { ensureFilenameExt } from '../utils/ensure-filename-extension';
import { VideoRepository } from '../video.repoistory';
import { VideoStorageService } from '../services/video-storage.service';

export class UploadingS3Handler implements PhaseHandler {
	constructor(
		private readonly videoRepo: VideoRepository,
		private readonly storage: VideoStorageService,
	) {}

	async handle(video: Video): Promise<PhaseHandleResult> {
		const localPath = video.converted_tmp_path;
		if (!localPath || !fs.existsSync(localPath)) {
			throw new Error(`Tmp file missing for upload (video ${video.id})`);
		}

		const detected = await detectVideoMime(localPath);
		const desiredMime = detected?.mime ?? (video.mime_type || 'application/octet-stream');
		const desiredFilename = detected?.ext ? ensureFilenameExt(video.filename, detected.ext) : video.filename;

		const mimeChanged = desiredMime !== (video.mime_type || '');
		const nameChanged = desiredFilename !== video.filename;

		if (mimeChanged || nameChanged) {
			await this.videoRepo.update(video.id, {
				user_id: video.user_id,
				filename: desiredFilename,
				mime_type: desiredMime,
				total_size: video.total_size,
			});
			video = (await this.videoRepo.findById(video.id)) || video;
		}

		if (!video.storage_key) {
			if (!video.checksum_sha256_base64) {
				throw new Error(`Checksum missing before upload (video ${video.id})`);
			}
			const size = fs.statSync(localPath).size;
			const storeRes = await this.storage.findOrUploadByChecksum({
				localPath,
				filename: video.filename,
				contentType: video.mime_type || 'application/octet-stream',
				contentLength: size,
				checksumBase64: video.checksum_sha256_base64,
				metadata: { userId: video.user_id },
			});

			await this.videoRepo.update(video.id, {
				user_id: video.user_id,
				filename: video.filename,
				mime_type: video.mime_type,
				total_size: video.total_size,
				storage_key: storeRes.storageKey,
				checksum_sha256_base64: video.checksum_sha256_base64,
			});

			video = (await this.videoRepo.findById(video.id)) || video;
		}

		if (localPath && fs.existsSync(localPath)) {
			fs.unlinkSync(localPath);
		}

		return { kind: 'advance', nextPhase: 'completed' };
	}
}
