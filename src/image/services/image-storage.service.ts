import { Injectable, Logger } from '@nestjs/common';
import got from 'got';
import { IImageStorageService } from '../../image/ports/image-storage.adapter';
import { ImageStorageAdapter } from '../adapters/image-storage.adapter';

@Injectable()
export class ImageStorageService implements IImageStorageService {
	private readonly logger = new Logger(ImageStorageService.name);

	constructor(private readonly imageStorageAdapter: ImageStorageAdapter) {}

	async uploadImage(url: string): Promise<string> {
		this.logger.log(`Downloading image from URL: ${url}`);

		try {
			const imageStream = got.stream(url);

			const key = await this.imageStorageAdapter.uploadImage(imageStream);
			this.logger.log(`Image uploaded to S3 with key: ${key}`);
			return key;
		} catch (error) {
			if (error instanceof got.RequestError) {
				this.logger.error(`Failed to download image from ${url}:`, error);
				throw new Error('Image download failed');
			} else {
				this.logger.error('Failed to upload image to S3:', error);
				throw new Error('Image upload to S3 failed');
			}
		}
	}
}
