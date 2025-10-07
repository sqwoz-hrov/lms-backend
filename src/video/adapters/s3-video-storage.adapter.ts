import { GetObjectCommand, HeadObjectCommand, S3Client, S3ServiceException } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { s3Config } from '../../config';
import { IS3VideoStorageAdapter, UploadStreamInput, UploadStreamResult } from '../ports/video-storage.adapter';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

	async headHotObject({
		key,
	}: {
		key: string;
	}): Promise<{ exists: boolean; eTag?: string; size?: number; metadata?: Record<string, string> }> {
		try {
			const res = await this.s3Client.send(
				new HeadObjectCommand({
					Bucket: this.config.videosHotBucketName,
					Key: key,
				}),
			);

			this.logger.log(`HEAD hot video OK: ${key}`);
			return {
				exists: true,
				eTag: res.ETag ?? undefined,
				size: typeof res.ContentLength === 'number' ? res.ContentLength : Number(res.ContentLength ?? 0),
				metadata: (res.Metadata as Record<string, string>) ?? undefined,
			};
		} catch (error) {
			if (error instanceof S3ServiceException) {
				const code = error.$metadata?.httpStatusCode;
				if (code === 404 || code === 403) return { exists: false };
			}
			throw error;
		}
	}

	async uploadStreamToCold(input: UploadStreamInput): Promise<UploadStreamResult> {
		const upload = new Upload({
			client: this.s3Client,
			params: {
				Bucket: this.config.videosColdBucketName,
				Key: input.key,
				Body: input.stream,
				Metadata: input.metadata,
				ACL: 'private',
				ContentType: input.contentType,
			},
		});

		try {
			const result = await upload.done();
			this.logger.log(`Video uploaded to COLD: ${input.key}`);
			return { storageKey: result.Key ?? input.key };
		} catch (error) {
			this.logger.error('Error uploading video to COLD S3:', error);
			throw new Error('Failed to upload video to S3 (cold)');
		}
	}

	async uploadStreamToHot(input: UploadStreamInput): Promise<UploadStreamResult> {
		const upload = new Upload({
			client: this.s3Client,
			params: {
				Bucket: this.config.videosHotBucketName,
				Key: input.key,
				Body: input.stream,
				Metadata: input.metadata,
				ACL: 'private',
				ContentType: input.contentType,
			},
		});

		try {
			const result = await upload.done();
			this.logger.log(`Video uploaded to HOT: ${input.key}`);
			return { storageKey: result.Key ?? input.key };
		} catch (error) {
			this.logger.error('Error uploading video to HOT S3:', error);
			throw new Error('Failed to upload video to S3 (hot)');
		}
	}

	async getPresignedUrl(
		key: string,
		opts?: {
			expiresInSeconds?: number;
			asAttachmentName?: string;
			responseContentType?: string;
		},
	): Promise<string> {
		const expiresIn = opts?.expiresInSeconds ?? 3600 * 3; // 3 hours

		const responseContentDisposition = opts?.asAttachmentName
			? `attachment; filename="${encodeURIComponent(opts.asAttachmentName)}"`
			: undefined;

		try {
			const cmd = new GetObjectCommand({
				Bucket: this.config.videosHotBucketName,
				Key: key,
				ResponseContentDisposition: responseContentDisposition,
				ResponseContentType: opts?.responseContentType,
			});

			const url = await getSignedUrl(this.s3Client, cmd, { expiresIn });
			this.logger.log(`Issued presigned URL for hot video: ${key} (exp=${expiresIn}s)`);
			return url;
		} catch (error) {
			this.logger.error(`Error creating presigned URL for ${key}:`, error as Error);
			throw new Error('Failed to create presigned URL');
		}
	}
}
