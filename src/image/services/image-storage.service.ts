import { Inject, Injectable, Logger } from '@nestjs/common';
import got from 'got';
import { IImageStorageAdapter } from '../../image/ports/image-storage.adapter';
import { IMAGE_STORAGE_ADAPTER } from '../constants';

@Injectable()
export class ImageStorageService {
	private readonly logger = new Logger(ImageStorageService.name);

	constructor(
		@Inject(IMAGE_STORAGE_ADAPTER)
		private readonly imageStorageAdapter: IImageStorageAdapter,
	) {}

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
