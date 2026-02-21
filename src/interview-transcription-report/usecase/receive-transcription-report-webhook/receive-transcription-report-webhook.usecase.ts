import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { z } from 'zod';
import { InterviewTranscriptionReportRepository } from '../../interview-transcription-report.repository';

const llmReportParsedSchema = z.array(
	z.discriminatedUnion('hintType', [
		z.object({
			hintType: z.literal('error'),
			lineId: z.number().int(),
			topic: z.string(),
			errorType: z.enum(['blunder', 'inaccuracy']),
			whyBad: z.string(),
			howToFix: z.string(),
		}),
		z.object({
			hintType: z.literal('note'),
			lineId: z.number().int(),
			topic: z.string(),
			note: z.string(),
		}),
		z.object({
			hintType: z.literal('praise'),
			lineId: z.number().int(),
			topic: z.string(),
			praise: z.string(),
		}),
	]),
);

const webhookPayloadSchema = z.object({
	transcriptionId: z.string().uuid(),
	llmReportParsed: llmReportParsedSchema,
	candidateNameInTranscription: z
		.string()
		.min(1)
		.regex(/^SPEAKER_\d+$/),
	candidateName: z.string().min(1).optional(),
});

export type ReceiveTranscriptionReportWebhookParams = z.infer<typeof webhookPayloadSchema>;

@Injectable()
export class ReceiveTranscriptionReportWebhookUsecase implements UsecaseInterface {
	private readonly logger = new Logger(ReceiveTranscriptionReportWebhookUsecase.name);

	constructor(private readonly transcriptionReportRepository: InterviewTranscriptionReportRepository) {}

	async execute({ params }: { params: unknown }): Promise<void> {
		this.logger.debug('Received transcription report webhook with params:', params);

		const parsed = webhookPayloadSchema.safeParse(params);
		if (!parsed.success) {
			throw new BadRequestException(`Invalid payload: ${parsed.error.message}`);
		}

		await this.transcriptionReportRepository.save({
			interview_transcription_id: parsed.data.transcriptionId,
			llm_report_parsed: parsed.data.llmReportParsed,
			candidate_name_in_transcription: parsed.data.candidateNameInTranscription,
			candidate_name: parsed.data.candidateName,
		});
	}
}
