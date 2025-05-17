export interface IImageStorageService {
	uploadImage(url: string): Promise<string>;
}
