import { z } from 'zod';

const interviewTranscriptionChunkEventSchema = z.object({
	type: z.literal('interview-transcription-chunk'),
	interviewTranscriptionId: z.string(),
	videoId: z.string(),
	chunkIndex: z.number(),
	text: z.string(),
	startTimeSec: z.number(),
	endTimeSec: z.number(),
	speakerLabel: z.string().optional(),
});

export type InterviewTranscriptionChunkSSE = z.infer<typeof interviewTranscriptionChunkEventSchema>;

const sseEventSchemas = {
	'interview-transcription-chunk': interviewTranscriptionChunkEventSchema,
} as const;

export type SseEventMap = {
	[K in keyof typeof sseEventSchemas]: z.infer<(typeof sseEventSchemas)[K]>;
};

export const validateSseEventPayload = <TEvent extends keyof typeof sseEventSchemas>(
	event: TEvent,
	payload: unknown,
): SseEventMap[TEvent] => sseEventSchemas[event].parse(payload);
