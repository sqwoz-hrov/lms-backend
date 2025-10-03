import { Readable } from 'stream';

export type UploadStreamInput = {
	key: string;
	stream: Readable;
	contentType: string;
	contentLength: number;
	contentEncoding: string;
	checksumBase64?: string;
	metadata?: Record<string, string>;
};

export type UploadStreamResult = { storageKey: string };

export interface IS3VideoStorageAdapter {
	uploadStreamToCold(input: UploadStreamInput): Promise<UploadStreamResult>;
	uploadStreamToHot(input: UploadStreamInput): Promise<UploadStreamResult>;
}
