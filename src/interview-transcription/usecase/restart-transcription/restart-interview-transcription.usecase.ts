import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { RestartInterviewTranscriptionDto } from '../../dto/restart-interview-transcription.dto';
import { InterviewTranscriptionRepository } from '../../interview-transcription.repository';
import { InterviewTranscriptionService } from '../../services/interview-transcription.service';
import { UserWithSubscriptionTier } from '../../../user/user.entity';

@Injectable()
export class RestartInterviewTranscriptionUsecase implements UsecaseInterface {
	constructor(
		private readonly transcriptionRepository: InterviewTranscriptionRepository,
		private readonly transcriptionService: InterviewTranscriptionService,
	) {}

	async execute({
		params,
		user,
	}: {
		params: RestartInterviewTranscriptionDto;
		user: UserWithSubscriptionTier;
	}): Promise<InterviewTranscriptionResponseDto> {
		const transcription = await this.transcriptionRepository.findByIdWithVideo(params.interview_transcription_id);
		if (!transcription) {
			throw new NotFoundException('Запись транскрибации интервью не найдена');
		}

		if (user.role !== 'admin' && transcription.video.user_id !== user.id) {
			throw new ForbiddenException('Вы можете перезапускать транскрибацию только для своих видео');
		}

		if (transcription.status === 'done') {
			const updated = await this.transcriptionRepository.updateStatus(transcription.id, 'restarted', {
				s3_transcription_key: null,
			});

			if (!updated) {
				throw new BadRequestException('Не удалось перезапустить транскрибацию интервью');
			}
		}

		return await this.transcriptionService.enqueueTranscription(transcription.id);
	}
}
