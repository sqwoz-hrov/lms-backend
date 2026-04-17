import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const aiUsageLimitsConfig = registerAs('aiUsageLimits', () => ({
	interviewTranscriptionHourly: get('AI_USAGE_INTERVIEW_TRANSCRIPTION_LIMIT_HOURLY').default('3').asIntPositive(),
	interviewTranscriptionDaily: get('AI_USAGE_INTERVIEW_TRANSCRIPTION_LIMIT_DAILY').default('3').asIntPositive(),
}));
