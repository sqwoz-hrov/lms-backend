import { z } from 'zod';

const uploadPhaseSchema = z.enum(['receiving', 'converting', 'hashing', 'uploading_s3', 'completed', 'failed']);

const sseEventSchemas = {
	interview_transcription_report_ready: z.object({
		transcriptionId: z.string().uuid(),
	}),
	video_upload_phase_changed: z.object({
		videoId: z.string().uuid(),
		phase: uploadPhaseSchema,
	}),
} as const;

export type SseEventMap = {
	[K in keyof typeof sseEventSchemas]: z.infer<(typeof sseEventSchemas)[K]>;
};

export const validateSseEventPayload = <TEvent extends keyof typeof sseEventSchemas>(
	event: TEvent,
	payload: unknown,
): SseEventMap[TEvent] => {
	const schema = sseEventSchemas[event] as z.ZodTypeAny | undefined;

	if (!schema) {
		throw new Error(`No SSE schema registered for event ${event}`);
	}

	return schema.parse(payload) as SseEventMap[TEvent];
};
