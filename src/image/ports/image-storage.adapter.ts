import { Readable } from 'node:stream';

export interface IImageStorageAdapter {
	uploadImage(stream: Readable): Promise<string>;
}
