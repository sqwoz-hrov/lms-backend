import { Module } from '@nestjs/common';
import { S3VideoStorageAdapter } from './adapters/s3-video-storage.adapter';
import { ChunkUploadService } from './services/chunk-upload.service';
import { VideoStorageService } from './services/video-storage.service';
import { VideoTranscoderService } from './services/video-transcoder.service';
import { GetVideoController } from './usecase/get-video/get-video.controller';
import { GetVideoUsecase } from './usecase/get-video/get-video.usecase';
import { UploadVideoController } from './usecase/upload-video/upload-video.controller';
import { UploadVideoUsecase } from './usecase/upload-video/upload-video.usecase';
import { VideoRepository } from './video.repoistory';
import { FormidableTimingProbe } from '../common/testing/formidable-timing-probe';
import { ResumeUploadsUsecase } from './usecase/resume-uploads/resume-uploads.usecase';
import { WorkflowRunnerService } from './services/workflow-runner.service';

@Module({
	controllers: [GetVideoController, UploadVideoController],
	providers: [
		S3VideoStorageAdapter,
		ChunkUploadService,
		VideoStorageService,
		VideoTranscoderService,
		WorkflowRunnerService,
		GetVideoUsecase,
		ResumeUploadsUsecase,
		UploadVideoUsecase,
		VideoRepository,
		FormidableTimingProbe,
	],
})
export class VideoModule {}
