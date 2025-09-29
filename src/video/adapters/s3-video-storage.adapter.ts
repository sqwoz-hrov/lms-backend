import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { s3Config } from '../../config';
import { IS3VideoStorageAdapter, UploadStreamInput, UploadStreamResult } from '../ports/video-storage.adapter';

@Injectable()
export class S3VideoStorageAdapter implements IS3VideoStorageAdapter {
	private readonly logger = new Logger(S3VideoStorageAdapter.name);
	private readonly s3Client: S3Client;

	constructor(
		@Inject(s3Config.KEY)
		private readonly config: ConfigType<typeof s3Config>,
	) {
		this.s3Client = new S3Client({
			region: this.config.region,
			endpoint: this.config.endpoint,
			credentials: {
				accessKeyId: this.config.accessKeyId,
				secretAccessKey: this.config.secretAccessKey,
			},
		});
	}

	async uploadStreamToCold(input: UploadStreamInput): Promise<UploadStreamResult> {
		const upload = new Upload({
			client: this.s3Client,
			params: {
				Bucket: this.config.videosColdBucketName,
				Key: `videos/${input.key}`,
				Body: input.stream,
				Metadata: input.metadata,
				ACL: 'private',
			},
		});

		try {
			const result = await upload.done();
			this.logger.log(`Video ${input.key} uploaded successfully.`);
			return { storageKey: result.Key! };
		} catch (error) {
			this.logger.error('Error uploading video to S3:', error);
			throw new Error('Failed to upload video to S3');
		}
	}

	async uploadStreamToHot(input: UploadStreamInput): Promise<UploadStreamResult> {
		const upload = new Upload({
			client: this.s3Client,
			params: {
				Bucket: this.config.videosHotBucketName,
				Key: `videos/${input.key}`,
				Body: input.stream,
				Metadata: input.metadata,
				ACL: 'private',
			},
		});

		try {
			const result = await upload.done();
			this.logger.log(`Video ${input.key} uploaded successfully.`);
			return { storageKey: result.Key! };
		} catch (error) {
			this.logger.error('Error uploading video to S3:', error);
			throw new Error('Failed to upload video to S3');
		}
	}
}
