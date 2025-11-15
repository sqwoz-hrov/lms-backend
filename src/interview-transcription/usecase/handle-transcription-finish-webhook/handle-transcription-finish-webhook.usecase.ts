import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { InterviewTranscriptionWebhookDto } from '../../dto/interview-transcription-webhook.dto';
import { InterviewTranscriptionRepository } from '../../interview-transcription.repository';
import { InterviewTranscriptionService } from '../../services/interview-transcription.service';

@Injectable()
export class HandleTranscriptionFinishWebhookUsecase implements UsecaseInterface {
	constructor(
		private readonly transcriptionRepository: InterviewTranscriptionRepository,
		private readonly transcriptionService: InterviewTranscriptionService,
	) {}

	async execute(params: InterviewTranscriptionWebhookDto): Promise<InterviewTranscriptionResponseDto> {
		const transcription = await this.transcriptionRepository.markDone(
			params.interview_transcription_id,
			params.s3_transcription_key,
		);

		if (!transcription) {
			throw new NotFoundException('Запись транскрибации не найдена');
		}

		await this.transcriptionService.handleTranscriptionFinished();

		return transcription;
	}
}
