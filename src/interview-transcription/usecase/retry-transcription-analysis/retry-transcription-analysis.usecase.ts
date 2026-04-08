import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { InterviewTranscriptionRepository } from '../../interview-transcription.repository';
import { InterviewTranscriptionService } from '../../services/interview-transcription.service';
import { RetryTranscriptionAnalysisParamsDto } from '../../../interview-transcription-report/dto/retry-transcription-analysis.dto';

@Injectable()
export class RetryTranscriptionAnalysisUsecase implements UsecaseInterface {
	constructor(
		private readonly transcriptionRepository: InterviewTranscriptionRepository,
		private readonly transcriptionService: InterviewTranscriptionService,
	) {}

	async execute({
		params,
		user,
	}: {
		params: RetryTranscriptionAnalysisParamsDto;
		user: UserWithSubscriptionTier;
	}): Promise<InterviewTranscriptionResponseDto> {
		const transcription = await this.transcriptionRepository.findByIdWithVideo(params.transcription_id);
		if (!transcription) {
			throw new NotFoundException('Запись транскрибации интервью не найдена');
		}

		if (user.role !== 'admin' && transcription.video.user_id !== user.id) {
			throw new ForbiddenException('Вы можете перезапускать аналитику только для своих видео');
		}

		if (transcription.status !== 'done') {
			throw new BadRequestException('Аналитику можно перезапустить только после завершения транскрибации');
		}

		if (!transcription.s3_transcription_key) {
			throw new BadRequestException('Нет готового файла транскрибации для повторного анализа');
		}

		return await this.transcriptionService.enqueueTranscriptionAnalysis(transcription.id);
	}
}
