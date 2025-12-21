import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { StartInterviewTranscriptionDto } from '../../dto/start-interview-transcription.dto';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { InterviewTranscriptionRepository } from '../../interview-transcription.repository';
import { InterviewTranscriptionService } from '../../services/interview-transcription.service';
import { VideoRepository } from '../../../video/video.repoistory';

@Injectable()
export class StartInterviewTranscriptionUsecase implements UsecaseInterface {
	constructor(
		private readonly videoRepository: VideoRepository,
		private readonly transcriptionRepository: InterviewTranscriptionRepository,
		private readonly transcriptionService: InterviewTranscriptionService,
	) {}

	async execute({
		params,
		user,
	}: {
		params: StartInterviewTranscriptionDto;
		user: UserWithSubscriptionTier;
	}): Promise<InterviewTranscriptionResponseDto> {
		const video = await this.videoRepository.findById(params.video_id);
		if (!video) {
			throw new NotFoundException('Видео не найдено');
		}

		if (user.role !== 'admin' && video.user_id !== user.id) {
			throw new ForbiddenException('Вы можете запускать транскрибацию только для своих видео');
		}

		if (video.phase !== 'completed' || !video.storage_key) {
			throw new BadRequestException('Видео еще обрабатывается, транскрибация недоступна');
		}

		const existing = await this.transcriptionRepository.findLatestByVideoId(video.id, [
			'created',
			'processing',
			'restarted',
		]);
		if (existing) {
			if (existing.status === 'created' || existing.status === 'restarted') {
				return await this.transcriptionService.enqueueTranscription(existing.id);
			}

			return existing;
		}

		const transcription = await this.transcriptionRepository.create({
			video_id: video.id,
			status: 'created',
			s3_transcription_key: null,
		});

		return await this.transcriptionService.enqueueTranscription(transcription.id);
	}
}
