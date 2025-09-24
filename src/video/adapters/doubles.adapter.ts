import { Readable } from 'node:stream';
import { IS3VideoStorageAdapter, IYoutubeVideoStorageAdapter } from '../ports/video-storage.adapter';

export type Capture = {
	totalBytes: number;
	firstChunkAt?: number;
	firstChunkIndex?: number;
	lastChunkAt?: number;
	lastChunkIndex?: number;
};

export class YoutubeAdapterDouble implements IYoutubeVideoStorageAdapter {
	capture: Capture = { totalBytes: 0 };

	async uploadVideo({ file }: { file: Readable; title: string }): Promise<string> {
		let idx = 0;
		const start = Date.now();

		await new Promise<void>((resolve, reject) => {
			file.on('data', (chunk: Buffer) => {
				if (this.capture.firstChunkAt === undefined) {
					this.capture.firstChunkAt = Date.now();
					this.capture.firstChunkIndex = idx;
				}
				this.capture.totalBytes += chunk.length;
				this.capture.lastChunkAt = Date.now(); // ⟵ фиксируем время последнего полученного чанка
				this.capture.lastChunkIndex = idx; // ⟵ индекс последнего чанка
				idx++;
			});
			file.once('error', () => reject(new Error('YT upload error')));
			file.once('end', () => resolve());
			file.resume();
		});

		return `https://www.youtube.com/watch?v=fake-${start}`;
	}
}

export class S3AdapterDouble implements IS3VideoStorageAdapter {
	capture: Capture = { totalBytes: 0 };

	async uploadVideo({ file }: { id: string; file: Readable; title: string; slow?: string }): Promise<void> {
		let idx = 0;

		await new Promise<void>((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			file.on('data', async (chunk: Buffer) => {
				if (this.capture.firstChunkAt === undefined) {
					this.capture.firstChunkAt = Date.now();
					this.capture.firstChunkIndex = idx;
				}
				this.capture.totalBytes += chunk.length;
				this.capture.lastChunkAt = Date.now(); // ⟵ фиксируем на каждом чанке
				this.capture.lastChunkIndex = idx;
				idx++;

				// медленный потребитель — имитируем бэкпрешсур
				await new Promise(r => setTimeout(r, 2));
			});
			file.once('error', () => reject(new Error('S3 upload error')));
			file.once('end', () => resolve());
			file.resume();
		});
	}
}
