import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { GetInterviewTranscriptionDto } from '../../dto/get-interview-transcription.dto';
import { InterviewTranscriptionRepository } from '../../interview-transcription.repository';
import { S3VideoStorageAdapter } from '../../../video/adapters/s3-video-storage.adapter';
import { InterviewTranscription } from '../../interview-transcription.entity';

@Injectable()
export class GetInterviewTranscriptionUsecase implements UsecaseInterface {
	constructor(
		private readonly transcriptionRepository: InterviewTranscriptionRepository,
		private readonly s3VideoStorageAdapter: S3VideoStorageAdapter,
	) {}

	async execute({
		params,
		user,
	}: {
		params: GetInterviewTranscriptionDto;
		user: UserWithSubscriptionTier;
	}): Promise<InterviewTranscriptionResponseDto> {
		const transcription = await this.transcriptionRepository.findByIdWithVideo(params.transcription_id);
		if (!transcription) {
			throw new NotFoundException('Транскрибация не найдена');
		}

		if (user.role !== 'admin' && transcription.video.user_id !== user.id) {
			throw new ForbiddenException('Вы можете просматривать транскрибации только своих видео');
		}

		const transcription_url = await this.buildTranscriptionUrl(transcription);

		return {
			...transcription,
			transcription_url,
		};
	}

	private async buildTranscriptionUrl(transcription: InterviewTranscription): Promise<string | undefined> {
		if (transcription.status !== 'done' || !transcription.s3_transcription_key) {
			return undefined;
		}

		return await this.s3VideoStorageAdapter.getPresignedUrl(transcription.s3_transcription_key, {
			asAttachmentName: this.extractFileName(transcription.s3_transcription_key),
			responseContentType: 'application/json',
		});
	}

	private extractFileName(key: string): string {
		const parts = key.split('/').filter(Boolean);
		return parts.length > 0 ? parts[parts.length - 1] : 'transcription.json';
	}
}
