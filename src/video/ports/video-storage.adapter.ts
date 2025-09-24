import { Readable } from 'stream';

export interface IS3VideoStorageAdapter {
	uploadVideo: (params: { id: string; file: Readable; title: string }) => Promise<void>;
}

export interface IYoutubeVideoStorageAdapter {
	uploadVideo(params: { file: Readable; title: string }): Promise<string>;
}
