import { IImageStorageAdapter } from '../ports/image-storage.adapter';

export class ImageStorageAdapter implements IImageStorageAdapter {
	async uploadImage(): Promise<string> {
		return Promise.resolve('https://example.com/uploaded-image.jpg');
	}
}
