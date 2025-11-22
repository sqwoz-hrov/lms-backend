import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const interviewTranscriptionConfig = registerAs('interviewTranscription', () => ({
	webhookSecret: get('INTERVIEW_TRANSCRIPTION_WEBHOOK_SECRET').default('').asString(),
	webhookSignatureHeader: get('INTERVIEW_TRANSCRIPTION_WEBHOOK_SIGNATURE_HEADER')
		.default('x-webhook-signature')
		.asString(),
}));
