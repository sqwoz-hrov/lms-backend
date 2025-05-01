export interface IImageStorageAdapter {
	uploadImage(image_url: string): Promise<string>;
}
