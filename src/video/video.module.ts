import { DynamicModule, Module } from '@nestjs/common';
import { S3AdapterDouble, YoutubeAdapterDouble } from './adapters/doubles.adapter';
import { S3VideoStorageAdapter } from './adapters/s3-video-storage.adapter';
import { YoutubeVideoStorageAdapter } from './adapters/youtube-video-storage.adapter';
import { S3_VIDEO_STORAGE_ADAPTER, YOUTUBE_VIDEO_STORAGE_ADAPTER } from './constants';
import { VideoStorageService } from './services/video-storage.service';
import { GetVideoController } from './usecase/get-video/get-video.controller';
import { GetVideoUsecase } from './usecase/get-video/get-video.usecase';
import { UploadVideoController } from './usecase/upload-video/upload-video.controller';
import { UploadVideoUsecase } from './usecase/upload-video/upload-video.usecase';
import { VideoRepository } from './video.repoistory';
import { FormidableTimingProbe } from '../common/testing/formidable-timing-probe';

@Module({})
export class VideoModule {
	static forRoot({ useRealStorageAdapters }: { useRealStorageAdapters: boolean }): DynamicModule {
		if (useRealStorageAdapters) {
			return {
				module: VideoModule,
				global: true,
				controllers: [GetVideoController, UploadVideoController],
				providers: [
					GetVideoUsecase,
					{
						provide: S3_VIDEO_STORAGE_ADAPTER,
						useClass: S3VideoStorageAdapter,
					},
					{
						provide: YOUTUBE_VIDEO_STORAGE_ADAPTER,
						useClass: YoutubeVideoStorageAdapter,
					},
					VideoStorageService,
					UploadVideoUsecase,
					VideoRepository,
				],
			};
		}
		return {
			module: VideoModule,
			global: true,
			controllers: [GetVideoController, UploadVideoController],
			providers: [
				GetVideoUsecase,
				{
					provide: S3_VIDEO_STORAGE_ADAPTER,
					useClass: S3AdapterDouble,
				},
				{
					provide: YOUTUBE_VIDEO_STORAGE_ADAPTER,
					useClass: YoutubeAdapterDouble,
				},
				VideoStorageService,
				UploadVideoUsecase,
				VideoRepository,
				FormidableTimingProbe,
			],
		};
	}
}
