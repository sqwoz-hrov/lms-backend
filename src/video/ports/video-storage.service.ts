import { Readable } from 'node:stream';

export interface IVideoStorageService {
	uploadVideo({ file, title }: { file: Readable; title: string }): Promise<{ youtubeLink: string; s3ObjectId: string }>;
}
