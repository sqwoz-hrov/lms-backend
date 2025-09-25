import { Injectable } from '@nestjs/common';
import { VideoStorageService } from '../../services/video-storage.service';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { Readable } from 'stream';
import { VideoRepository } from '../../video.repoistory';

@Injectable()
export class UploadVideoUsecase implements UsecaseInterface {
	constructor(
		private readonly videoStorageService: VideoStorageService,
		private readonly videoRepository: VideoRepository,
	) {}

	async execute({ stream }: { stream: Readable }) {
		const { youtubeLink, s3ObjectId } = await this.videoStorageService.uploadVideo({
			file: stream,
			title: new Date().toISOString(),
		});

		const video = await this.videoRepository.save({
			youtube_link: youtubeLink,
			s3_object_id: s3ObjectId,
		});

		return video;
	}
}
