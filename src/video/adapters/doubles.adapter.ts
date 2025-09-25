import { Readable } from 'node:stream';
import { IS3VideoStorageAdapter, IYoutubeVideoStorageAdapter } from '../ports/video-storage.adapter';

export type Capture = {
	totalBytes: number;
	firstChunkAt?: number;
	lastChunkAt?: number;
	firstChunkIndex?: number;
	lastChunkIndex?: number;
	attempts: number;
	bytesPerAttempt: number[];
};

export class YoutubeAdapterDouble implements IYoutubeVideoStorageAdapter {
	capture: Capture = { totalBytes: 0, attempts: 0, bytesPerAttempt: [] };

	public failOnceAtChunkIndex?: number;

	async uploadVideo({ file }: { file: Readable; title: string }): Promise<string> {
		this.capture.attempts++;
		let idx = 0;
		let bytesThisAttempt = 0;
		const startedAt = Date.now();

		await new Promise<void>((resolve, reject) => {
			file.on('data', (chunk: Buffer) => {
				if (this.capture.firstChunkAt === undefined) {
					this.capture.firstChunkAt = Date.now();
					this.capture.firstChunkIndex = idx;
				}
				this.capture.totalBytes += chunk.length;
				bytesThisAttempt += chunk.length;

				if (
					this.failOnceAtChunkIndex !== undefined &&
					this.capture.attempts === 1 &&
					idx === this.failOnceAtChunkIndex
				) {
					const err = new Error('Simulated YT fail');
					const r = file;
					this.failOnceAtChunkIndex = undefined;
					r.destroy(err);
					return;
				}

				this.capture.lastChunkAt = Date.now();
				this.capture.lastChunkIndex = idx;
				idx++;
			});

			file.once('error', e => {
				this.capture.bytesPerAttempt.push(bytesThisAttempt);
				reject(e);
			});
			file.once('end', () => {
				this.capture.bytesPerAttempt.push(bytesThisAttempt);
				resolve();
			});

			file.resume();
		});

		return `https://www.youtube.com/watch?v=fake-${startedAt}`;
	}
}

export class S3AdapterDouble implements IS3VideoStorageAdapter {
	capture: Capture = { totalBytes: 0, attempts: 0, bytesPerAttempt: [] };

	public failOnceAtChunkIndex?: number;

	async uploadVideo({ file }: { id: string; file: Readable; title: string }): Promise<void> {
		this.capture.attempts++;
		let idx = 0;
		let bytesThisAttempt = 0;

		await new Promise<void>((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			file.on('data', async (chunk: Buffer) => {
				if (this.capture.firstChunkAt === undefined) {
					this.capture.firstChunkAt = Date.now();
					this.capture.firstChunkIndex = idx;
				}
				this.capture.totalBytes += chunk.length;
				bytesThisAttempt += chunk.length;

				if (
					this.failOnceAtChunkIndex !== undefined &&
					this.capture.attempts === 1 &&
					idx === this.failOnceAtChunkIndex
				) {
					const err = new Error('Simulated S3 fail');
					const r = file;
					this.failOnceAtChunkIndex = undefined;
					r.destroy(err);
					return;
				}

				this.capture.lastChunkAt = Date.now();
				this.capture.lastChunkIndex = idx;
				idx++;

				await new Promise(r => setTimeout(r, 2));
			});

			file.once('error', e => {
				this.capture.bytesPerAttempt.push(bytesThisAttempt);
				reject(e);
			});
			file.once('end', () => {
				this.capture.bytesPerAttempt.push(bytesThisAttempt);
				resolve();
			});

			file.resume();
		});
	}
}
