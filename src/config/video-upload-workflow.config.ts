import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const videoUploadWorkflowConfig = registerAs('videoUploadWorkflow', () => ({
	retries: {
		receivingGate: Math.max(0, get('VIDEO_UPLOAD_RETRY_RECEIVING_GATE').default('0').asInt()),
		converting: Math.max(0, get('VIDEO_UPLOAD_RETRY_CONVERTING').default('2').asInt()),
		hashing: Math.max(0, get('VIDEO_UPLOAD_RETRY_HASHING').default('2').asInt()),
		uploadingS3: Math.max(0, get('VIDEO_UPLOAD_RETRY_UPLOADING_S3').default('4').asInt()),
	},
	backoff: {
		baseMs: Math.max(0, get('VIDEO_UPLOAD_RETRY_BACKOFF_BASE_MS').default('1000').asInt()),
		maxMs: Math.max(0, get('VIDEO_UPLOAD_RETRY_BACKOFF_MAX_MS').default('30000').asInt()),
	},
}));
