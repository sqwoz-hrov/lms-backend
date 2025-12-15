import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { GetInterviewTranscriptionDto } from '../../dto/get-interview-transcription.dto';
import { InterviewTranscriptionRepository } from '../../interview-transcription.repository';
import { VideoRepository } from '../../../video/video.repoistory';

@Injectable()
export class GetInterviewTranscriptionUsecase implements UsecaseInterface {
	constructor(
		private readonly videoRepository: VideoRepository,
		private readonly transcriptionRepository: InterviewTranscriptionRepository,
	) {}

	async execute({
		params,
		user,
	}: {
		params: GetInterviewTranscriptionDto;
		user: UserWithSubscriptionTier;
	}): Promise<InterviewTranscriptionResponseDto> {
		const video = await this.videoRepository.findById(params.video_id);
		if (!video) {
			throw new NotFoundException('Видео не найдено');
		}

		if (user.role !== 'admin' && video.user_id !== user.id) {
			throw new ForbiddenException('Вы можете просматривать транскрибации только своих видео');
		}

		const transcription = await this.transcriptionRepository.findLatestByVideoId(video.id);
		if (!transcription) {
			throw new NotFoundException('Транскрибация не найдена');
		}

		return transcription;
	}
}
