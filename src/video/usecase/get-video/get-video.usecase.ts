import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { User } from '../../../user/user.entity';
import { VideoRepository } from '../../video.repoistory';
import { VideoResponseDto } from '../../dto/base-video.dto';

@Injectable()
export class GetVideoUsecase implements UsecaseInterface {
	constructor(private readonly videoRepository: VideoRepository) {}

	execute({ video_id }: { video_id: string; user: User }): Promise<VideoResponseDto | undefined> {
		// @ts-ignore
		return this.videoRepository.findById(video_id);
	}
}
