import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { User } from '../../../user/user.entity';
import { GetVideoByIdResponseDto } from '../../dto/base-video.dto';
import { VideoRepository } from '../../video.repoistory';
import { S3VideoStorageAdapter } from '../../adapters/s3-video-storage.adapter';

@Injectable()
export class GetVideoUsecase implements UsecaseInterface {
	constructor(
		private readonly videoRepository: VideoRepository,
		private readonly s3VideoStorageAdapter: S3VideoStorageAdapter,
	) {}

	async execute({ video_id, user }: { video_id: string; user: User }): Promise<GetVideoByIdResponseDto | undefined> {
		const video = await this.videoRepository.findById(video_id);
		if (video?.phase != 'completed' || video.storage_key == null) {
			throw new NotFoundException('Video not found or still uploading');
		}

		if (user.role !== 'admin' && video.user_id !== user.id) {
			throw new ForbiddenException("You don't have rights to access this video");
		}

		const keyForS3 = video.storage_key;

		const video_url = await this.s3VideoStorageAdapter.getPresignedUrl(keyForS3, {
			asAttachmentName: video.filename,
			responseContentType: video.mime_type ?? undefined,
		});

		const response: GetVideoByIdResponseDto = {
			...video,
			video_url,
		};

		return response;
	}
}
