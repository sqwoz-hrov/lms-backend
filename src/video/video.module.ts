import { DynamicModule, Module } from '@nestjs/common';
import { S3VideoStorageAdapter } from './adapters/s3-video-storage.adapter';
import { YoutubeVideoStorageAdapter } from './adapters/youtube-video-storage.adapter';
import { VIDEO_STORAGE_SERVICE } from './constants';
import { FakeVideoStorageService } from './services/fake-video-storage.service';
import { VideoStorageService } from './services/video-storage.service';
import { GetVideoController } from './usecase/get-video/get-video.controller';
import { GetVideoUsecase } from './usecase/get-video/get-video.usecase';
import { UploadVideoController } from './usecase/upload-video/upload-video.controller';
import { UploadVideoUsecase } from './usecase/upload-video/upload-video.usecase';
import { VideoRepository } from './video.repoistory';

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
					S3VideoStorageAdapter,
					YoutubeVideoStorageAdapter,
					{
						provide: VIDEO_STORAGE_SERVICE,
						useClass: VideoStorageService,
					},
					UploadVideoUsecase,
					VideoRepository,
				],
			};
		}
		return {
			module: VideoModule,
			global: true,
			controllers: [UploadVideoController],
			providers: [
				{
					provide: VIDEO_STORAGE_SERVICE,
					useClass: FakeVideoStorageService,
				},
				UploadVideoUsecase,
				VideoRepository,
			],
		};
	}
}
