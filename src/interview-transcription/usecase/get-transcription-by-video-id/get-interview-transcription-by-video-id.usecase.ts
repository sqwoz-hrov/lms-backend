import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { GetInterviewTranscriptionByVideoIdDto } from '../../dto/get-interview-transcription-by-video-id.dto';
import { InterviewTranscriptionRepository } from '../../interview-transcription.repository';
import { VideoRepository } from '../../../video/video.repoistory';
import { S3VideoStorageAdapter } from '../../../video/adapters/s3-video-storage.adapter';

@Injectable()
export class GetInterviewTranscriptionByVideoIdUsecase implements UsecaseInterface {
	constructor(
		private readonly videoRepository: VideoRepository,
		private readonly transcriptionRepository: InterviewTranscriptionRepository,
		private readonly s3VideoStorageAdapter: S3VideoStorageAdapter,
	) {}

	async execute({
		params,
		user,
	}: {
		params: GetInterviewTranscriptionByVideoIdDto;
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

		let transcription_url: string | undefined;
		if (transcription.status === 'done' && transcription.s3_transcription_key) {
			transcription_url = await this.s3VideoStorageAdapter.getPresignedUrl(transcription.s3_transcription_key, {
				asAttachmentName: this.extractFileName(transcription.s3_transcription_key),
				responseContentType: 'application/json',
			});
		}

		return {
			...transcription,
			transcription_url,
		};
	}

	private extractFileName(key: string): string {
		const parts = key.split('/').filter(Boolean);
		return parts.length > 0 ? parts[parts.length - 1] : 'transcription.json';
	}
}
