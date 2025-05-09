import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const s3Config = registerAs('s3', () => ({
	accessKeyId: get('S3_SECRET_KEY_ID').required().asString(),
	secretAccessKey: get('S3_SECRET_KEY').required().asString(),
	region: get('S3_REGION').required().asString(),
	enpoint: get('S3_ENDPOINT').required().asString(),
	videosBucketName: get('S3_VIDEOS_BUCKET_NAME').required().asString(),
	imagesBucketName: get('S3_IMAGES_BUCKET_NAME').required().asString(),
	publicImagesUrl: get('S3_PUBLIC_IMAGES_URL').required().asString(),
}));
