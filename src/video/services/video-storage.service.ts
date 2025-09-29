import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

import { S3_VIDEO_STORAGE_ADAPTER } from '../constants';
import type { IS3VideoStorageAdapter } from '../ports/video-storage.adapter';
import { Readable, Writable } from 'stream';

export type UploadLocalFileInput = {
	localPath: string;
	filename: string;
	contentType: string;
	contentLength: number;
	checksumBase64?: string;
	metadata?: Record<string, string>;
};

export type UploadLocalFileResult = {
	storageKey: string;
	coldStorageKey?: string;
};

@Injectable()
export class VideoStorageService {
	private readonly logger = new Logger(VideoStorageService.name);

	constructor(
		@Inject(S3_VIDEO_STORAGE_ADAPTER)
		private readonly s3Storage: IS3VideoStorageAdapter,
	) {}

	/**
	 * Параллельно грузит локальный файл в два S3 (hot и cold).
	 * Возвращает URL/ключ из HOT.
	 */
	async uploadLocalFile(input: UploadLocalFileInput): Promise<UploadLocalFileResult> {
		const id = randomUUID();
		const safeName = sanitizeName(input.filename);
		const hotKey = `videos/${id}/${safeName}`;
		const coldKey = `videos/${id}/${safeName}`;

		// два независимых чтения с диска — надёжнее, чем tee/PassThrough
		const rsHot = fs.createReadStream(input.localPath, { highWaterMark: 1024 * 1024 });
		const rsCold = fs.createReadStream(input.localPath, { highWaterMark: 1024 * 1024 });

		const hotUpload = this.s3Storage.uploadStreamToHot({
			key: hotKey,
			stream: rsHot,
			contentType: input.contentType,
			contentLength: input.contentLength,
			checksumBase64: input.checksumBase64,
			metadata: input.metadata,
		});

		const coldUpload = this.s3Storage.uploadStreamToCold({
			key: coldKey,
			stream: rsCold,
			contentType: input.contentType,
			contentLength: input.contentLength,
			checksumBase64: input.checksumBase64,
			metadata: input.metadata,
		});

		try {
			const hotRes = await hotUpload;
			await coldUpload;

			return {
				storageKey: hotRes.storageKey ?? hotKey,
				coldStorageKey: coldKey,
			};
		} catch (err) {
			this.logger.error('Parallel S3 upload failed', err as Error);
			this.closeStreamSafely(rsHot, 'rsHot');
			this.closeStreamSafely(rsCold, 'rsCold');
			throw err;
		}
	}

	private closeStreamSafely(stream: Readable | Writable | null | undefined, label: string): boolean {
		if (!stream) return false;
		try {
			// если уже закрыт/уничтожен — ничего не делаем
			const anyStream = stream;
			const destroyed = Boolean(anyStream.destroyed);
			if (!destroyed) {
				stream.destroy(new Error('cleanup'));
				this.logger.debug(`Stream ${label} destroyed during cleanup`);
				return true;
			}
			return false;
		} catch (e) {
			this.logger.warn(`Failed to destroy stream ${label}: ${(e as Error).message}`);
			return false;
		}
	}
}

function sanitizeName(s: string): string {
	return s.replace(/[^\w.-]+/g, '_');
}
