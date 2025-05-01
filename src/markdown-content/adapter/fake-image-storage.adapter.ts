import { IImageStorageAdapter } from '../ports/image-storage.adapter';

export class FakeImageStorageAdapter implements IImageStorageAdapter {
	private imageCounter = 0;
	private uploadedImages = new Map();

	constructor(public readonly imageStorageUrl) {}

	uploadImage(image_url): Promise<string> {
		if (this.uploadedImages.has(image_url)) return Promise.resolve(this.uploadedImages.get(image_url));

		const url = `${this.imageStorageUrl}image${++this.imageCounter}.jpg`;
		this.uploadedImages.set(image_url, url);
		return Promise.resolve(url);
	}
}
