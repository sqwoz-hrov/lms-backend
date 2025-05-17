import { IImageStorageService } from '../ports/image-storage.adapter';

export class FakeImageStorageService implements IImageStorageService {
	private imageCounter = 0;
	private uploadedImages = new Map();

	constructor(public readonly imageStorageUrl) {}

	uploadImage(imageUrl: string): Promise<string> {
		if (this.uploadedImages.has(imageUrl)) return Promise.resolve(this.uploadedImages.get(imageUrl));

		const url = `${this.imageStorageUrl}image${++this.imageCounter}.jpg`;
		this.uploadedImages.set(imageUrl, url);
		return Promise.resolve(url);
	}
}
