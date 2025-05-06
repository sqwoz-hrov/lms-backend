import { pipeline, Readable } from 'node:stream';
import { YoutubeVideoStorageAdapter } from '../adapters/youtube-video-storage.adapter';
import { S3VideoStorageAdapter } from '../adapters/s3-video-storage.adapter';
import { Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PassThrough } from 'stream';
import { IVideoStorageService } from '../ports/video-storage.service';

export class VideoStorageService implements IVideoStorageService {
	private readonly logger = new Logger(VideoStorageService.name);

	constructor(
		@Inject(YoutubeVideoStorageAdapter)
		private readonly youtubeVideoStorageAdapter: YoutubeVideoStorageAdapter,
		@Inject(S3VideoStorageAdapter)
		private readonly s3VideoStorageAdapter: S3VideoStorageAdapter,
	) {}

	async uploadVideo({ file, title }: { file: Readable; title: string }) {
		// Create two identical streams using PassThrough
		const streamForYoutube = new PassThrough();
		const streamForS3 = new PassThrough();

		// Create a readable stream to distribute data
		const distributor = new PassThrough();

		pipeline(file, distributor, err => {
			if (err) {
				this.logger.error('Error in source stream', err);
			}
		});

		pipeline(distributor, streamForYoutube, err => {
			if (err) {
				this.logger.error('Error in YouTube stream pipeline', err);
			}
		});

		pipeline(distributor, streamForS3, err => {
			if (err) {
				this.logger.error('Error in S3 stream pipeline', err);
			}
		});

		// Generate S3 ID upfront
		const s3ObjectId = randomUUID();

		// Upload to both services concurrently
		const youtubePromise = this.uploadToYoutube({
			file: streamForYoutube,
			title,
		});

		const s3Promise = this.uploadToS3({
			id: s3ObjectId,
			file: streamForS3,
			title,
		});

		// Wait for both uploads to complete or fail
		try {
			const [youtubeLink] = await Promise.all([youtubePromise, s3Promise]);
			this.logger.log(`Video uploaded successfully to both YouTube (ID: ${youtubeLink}) and S3 (ID: ${s3ObjectId})`);
			return { youtubeLink, s3ObjectId };
		} catch (error) {
			this.logger.error('Failed to upload video to one or both services', error);
			throw new Error('Video upload failed');
		}
	}

	private async uploadToYoutube(params: { file: Readable; title: string }): Promise<string> {
		try {
			const youtubeVideoId = await this.youtubeVideoStorageAdapter.uploadVideo(params);
			this.logger.log(`Video uploaded to YouTube. ID: ${youtubeVideoId}`);
			return youtubeVideoId;
		} catch (err) {
			this.logger.error('Failed to upload video to YouTube.', err);
			throw new Error('Primary video upload failed (YouTube)');
		}
	}

	private async uploadToS3(params: { id: string; file: Readable; title: string }): Promise<void> {
		try {
			await this.s3VideoStorageAdapter.uploadVideo(params);
			this.logger.log(`Backup uploaded to S3 with ID: ${params.id}`);
		} catch (err) {
			this.logger.error(`S3 backup failed. ID: ${params.id}`, err);
			throw new Error('Backup upload failed (S3)');
		}
	}
}
