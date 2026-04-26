import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { videoUploadWorkflowConfig } from '../../config/video-upload-workflow.config';
import { UploadPhase } from '../video.entity';

export type RetryableWorkflowPhase = UploadPhase | 'receiving-gate';

@Injectable()
export class VideoUploadWorkflowPolicyService {
	constructor(
		@Inject(videoUploadWorkflowConfig.KEY)
		private readonly config: ConfigType<typeof videoUploadWorkflowConfig>,
	) {}

	retryLimitForPhase(phase: RetryableWorkflowPhase): number {
		switch (phase) {
			case 'receiving-gate':
			case 'receiving':
				return this.config.retries.receivingGate;
			case 'converting':
				return this.config.retries.converting;
			case 'hashing':
				return this.config.retries.hashing;
			case 'uploading_s3':
				return this.config.retries.uploadingS3;
			case 'completed':
			case 'failed':
				return 0;
			default:
				return 0;
		}
	}

	retryLimitForPersistedPhase(phase: UploadPhase | null | undefined): number | null {
		if (!phase) return null;
		return this.retryLimitForPhase(phase);
	}

	computeBackoffMs(retryIndex: number): number {
		if (retryIndex <= 0) return 0;
		if (this.config.backoff.baseMs <= 0 || this.config.backoff.maxMs <= 0) return 0;

		const multiplier = Math.pow(2, Math.max(0, retryIndex - 1));
		return Math.min(this.config.backoff.baseMs * multiplier, this.config.backoff.maxMs);
	}
}
