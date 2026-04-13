import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { InterviewTranscriptionRepository } from '../../interview-transcription.repository';
import { InterviewTranscriptionService } from '../../services/interview-transcription.service';

const failedWebhookPayloadSchema = z.object({
	videoId: z.string().uuid(),
	transcriptionId: z.string().uuid(),
	errorMessage: z.string().min(1),
	reason: z.literal('failed'),
});

const cancelledWebhookPayloadSchema = z.object({
	videoId: z.string().uuid(),
	transcriptionId: z.string().uuid(),
	reason: z.literal('cancelled'),
});

const webhookPayloadSchema = z.discriminatedUnion('reason', [
	failedWebhookPayloadSchema,
	cancelledWebhookPayloadSchema,
]);

type HandleTranscriptionFailedCancelledWebhookParams = z.infer<typeof webhookPayloadSchema>;

@Injectable()
export class HandleTranscriptionFailedCancelledWebhookUsecase implements UsecaseInterface {
    private readonly logger = new Logger(HandleTranscriptionFailedCancelledWebhookUsecase.name);

	constructor(
		private readonly transcriptionRepository: InterviewTranscriptionRepository,
		private readonly transcriptionService: InterviewTranscriptionService,
	) {}

	async execute(params: unknown): Promise<InterviewTranscriptionResponseDto> {
        this.logger.debug(`Received failed/cancelled webhook with payload: ${JSON.stringify(params)}`);
		const parsed = webhookPayloadSchema.safeParse(params);
		if (!parsed.success) {
			throw new BadRequestException(`Invalid payload: ${parsed.error.message}`);
		}

		return await this.handleWebhook(parsed.data);
	}

	private async handleWebhook(
		params: HandleTranscriptionFailedCancelledWebhookParams,
	): Promise<InterviewTranscriptionResponseDto> {
		const existing = await this.transcriptionRepository.findById(params.transcriptionId);
		if (!existing) {
			throw new NotFoundException('Запись транскрибации не найдена');
		}

		if (existing.video_id !== params.videoId) {
			throw new BadRequestException('Invalid payload: transcription does not belong to provided video');
		}

		const finalStatuses = ['failed', 'cancelled', 'done'] as const satisfies (typeof existing.status)[];
		if (finalStatuses.find(status => status === existing.status) !== undefined) {
			return existing;
		}

		const updated = await this.transcriptionRepository.updateStatus(existing.id, params.reason);
		if (!updated) {
			throw new NotFoundException('Запись транскрибации не найдена');
		}

		await this.transcriptionService.handleTranscriptionFinished();
		this.logger.debug(`Transcription ${existing.id} updated to status ${params.reason}`);
		return updated;
	}
}
