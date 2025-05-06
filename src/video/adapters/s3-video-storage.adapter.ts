import { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { s3Config } from '../../config/s3.config';

@Injectable()
export class S3VideoStorageAdapter {
	private readonly logger = new Logger(S3VideoStorageAdapter.name);
	private readonly s3Client: S3Client;

	constructor(
		@Inject(s3Config.KEY)
		private readonly config: ConfigType<typeof s3Config>,
	) {
		this.s3Client = new S3Client({
			region: this.config.region,
			endpoint: this.config.enpoint,
			credentials: {
				accessKeyId: this.config.accessKeyId,
				secretAccessKey: this.config.secretAccessKey,
			},
		});
	}

	async uploadVideo({ id, file, title }: { id: string; file: Readable; title: string }): Promise<void> {
		const upload = new Upload({
			client: this.s3Client,
			params: {
				Bucket: this.config.videosBucketName,
				Key: `videos/${id}`,
				Body: file,
				Metadata: {
					title,
				},
				ACL: 'private',
			},
		});

		try {
			await upload.done();
			this.logger.log(`Video ${id} uploaded successfully.`);
		} catch (error) {
			this.logger.error('Error uploading video to S3:', error);
			throw new Error('Failed to upload video to S3');
		}
	}
}
