import type { PhaseHandler, PhaseHandleResult } from '../ports/phase-handler';
import type { Video } from '../video.entity';
import * as fs from 'fs';
import { sha256File } from '../utils/sha-256-file';
import { VideoRepository } from '../video.repoistory';

export class HashingHandler implements PhaseHandler {
	constructor(private readonly videoRepo: VideoRepository) {}

	async handle(video: Video): Promise<PhaseHandleResult> {
		// Idempotent: if checksum already exists, just advance
		if (video.checksum_sha256_base64) {
			return { kind: 'advance', nextPhase: 'uploading_s3' };
		}

		if (!video.converted_tmp_path || !fs.existsSync(video.converted_tmp_path)) {
			throw new Error(`Tmp file missing for checksum (video ${video.id})`);
		}

		const checksum = await sha256File(video.converted_tmp_path);
		await this.videoRepo.setChecksum(video.id, checksum);

		return { kind: 'advance', nextPhase: 'uploading_s3' };
	}
}
