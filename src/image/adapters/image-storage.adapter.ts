import { Readable } from 'stream';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { s3Config } from '../../config';
import { randomUUID } from 'crypto';

@Injectable()
export class ImageStorageAdapter {
	private readonly logger = new Logger(ImageStorageAdapter.name);
	private readonly s3Client: S3Client;

	constructor(
		@Inject(s3Config.KEY)
		private readonly config: ConfigType<typeof s3Config>,
	) {
		this.s3Client = new S3Client({
			region: this.config.region,
			credentials: {
				accessKeyId: this.config.accessKeyId,
				secretAccessKey: this.config.secretAccessKey,
			},
		});
	}

	async uploadImage(stream: Readable): Promise<string> {
		const id = randomUUID();
		const key = `images/${id}`;

		const upload = new Upload({
			client: this.s3Client,
			params: {
				Bucket: this.config.imagesBucketName,
				Key: key,
				Body: stream,
				ACL: 'public-read',
			},
		});

		try {
			await upload.done();
			this.logger.log(`Image ${key} uploaded successfully.`);
			return `${this.config.publicImagesUrl}${key}`;
		} catch (error) {
			this.logger.error('Error uploading image to S3:', error);
			throw new Error('Failed to upload image to S3');
		}
	}
}
