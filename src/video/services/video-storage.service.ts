import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { Readable, Writable } from 'stream';
import { S3VideoStorageAdapter } from '../adapters/s3-video-storage.adapter';

export type UploadLocalFileInput = {
	localPath: string;
	filename: string;
	contentType: string;
	contentLength: number;
	checksumBase64?: string;
	contentEncoding: string;
	metadata?: Record<string, string>;
};

export type UploadLocalFileResult = {
	storageKey: string;
	coldStorageKey?: string;
	deduplicated?: boolean;
};

@Injectable()
export class VideoStorageService {
	private readonly logger = new Logger(VideoStorageService.name);

	constructor(private readonly s3Storage: S3VideoStorageAdapter) {}

	public async findOrUploadByChecksum(
		input: UploadLocalFileInput & { checksumBase64: string },
	): Promise<UploadLocalFileResult> {
		const hashHex = base64ToHex(input.checksumBase64);

		const { hotKey, coldKey } = buildNormalizedKeys({
			filename: input.filename,
			hashHex,
		});

		const head = await this.s3Storage.headHotObject({ key: hotKey }).catch(() => null);
		if (head?.exists) {
			return {
				storageKey: hotKey,
				coldStorageKey: undefined,
				deduplicated: true,
			};
		}

		const rsHot = fs.createReadStream(input.localPath, { highWaterMark: 1024 * 1024 });
		const rsCold = fs.createReadStream(input.localPath, { highWaterMark: 1024 * 1024 });

		const hotUpload = this.s3Storage.uploadStreamToHot({
			key: hotKey,
			stream: rsHot,
			contentType: input.contentType,
			contentLength: input.contentLength,
			checksumBase64: input.checksumBase64,
			metadata: input.metadata,
			contentEncoding: input.contentEncoding,
		});

		const coldUpload = this.s3Storage.uploadStreamToCold({
			key: coldKey,
			stream: rsCold,
			contentType: input.contentType,
			contentLength: input.contentLength,
			checksumBase64: input.checksumBase64,
			metadata: input.metadata,
			contentEncoding: input.contentEncoding,
		});

		try {
			const hotRes = await hotUpload;
			await coldUpload;

			return {
				storageKey: hotRes.storageKey ?? hotKey,
				coldStorageKey: coldKey,
				deduplicated: false,
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

function buildNormalizedKeys(args: { filename: string; hashHex: string }) {
	const safeName = sanitizeName(args.filename);
	const base = 'videos/by-hash';
	const hotKey = `${base}/${args.hashHex}/${safeName}`;
	const coldKey = `${base}/${args.hashHex}/${safeName}`;
	return { hotKey, coldKey };
}

function sanitizeName(s: string): string {
	const stripped = s.replace(/[/\\]+/g, '_').replace(/\.\.+/g, '.');
	const normalized = stripped
		.replace(/[^\w.-]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
	return normalized.toLowerCase();
}

function base64ToHex(b64: string): string {
	return Buffer.from(b64, 'base64').toString('hex');
}
