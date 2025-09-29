import { DynamicModule, Module } from '@nestjs/common';
import { FormidableTimingProbe } from '../common/testing/formidable-timing-probe';
import { S3VideoStorageAdapter } from './adapters/s3-video-storage.adapter';
import { S3_VIDEO_STORAGE_ADAPTER } from './constants';
import { VideoStorageService } from './services/video-storage.service';
import { GetVideoController } from './usecase/get-video/get-video.controller';
import { GetVideoUsecase } from './usecase/get-video/get-video.usecase';
import { UploadVideoController } from './usecase/upload-video/upload-video.controller';
import { UploadVideoUsecase } from './usecase/upload-video/upload-video.usecase';
import { VideoRepository } from './video.repoistory';
import { ChunkUploadService } from './services/chunk-upload.service';

@Module({})
export class VideoModule {
	static forRoot({ useRealStorageAdapters }: { useRealStorageAdapters: boolean }): DynamicModule {
		if (useRealStorageAdapters) {
			return {
				module: VideoModule,
				global: true,
				...(!process.env.DISABLE_VIDEO_MODULE && { controllers: [GetVideoController, UploadVideoController] }),
				providers: [
					{
						provide: S3_VIDEO_STORAGE_ADAPTER,
						useClass: S3VideoStorageAdapter,
					},
					ChunkUploadService,
					VideoStorageService,
					GetVideoUsecase,
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
				{
					provide: S3_VIDEO_STORAGE_ADAPTER,
					useClass: S3VideoStorageAdapter,
				},
				ChunkUploadService,
				VideoStorageService,
				GetVideoUsecase,
				UploadVideoUsecase,
				VideoRepository,
				FormidableTimingProbe,
			],
		};
	}
}
