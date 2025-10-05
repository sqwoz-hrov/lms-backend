import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import * as fs from 'fs';

/**
 * Пишет readable в filePath с позиции offset.
 * Гарантирует запись ровно expectedLength байт (иначе бросит ошибку).
 * Использует pwrite через fs.write с явной позицией.
 */
export async function writeStreamAtPosition(
	readable: Readable,
	filePath: string,
	offset: number,
	expectedLength: number,
) {
	const fd = await fs.promises.open(filePath, 'r+');
	let written = 0;

	const sink = new Writable({
		write(chunk: Buffer, _enc, cb) {
			const remaining = expectedLength - written;
			// на всякий случай ограничим последний кусок, если апстрим дал больше:
			const slice = remaining < chunk.length ? chunk.subarray(0, remaining) : chunk;

			fd.write(slice, 0, slice.length, offset + written)
				.then(() => {
					written += slice.length;
					cb();
				})
				.catch(cb);
		},
		final(cb) {
			cb();
		},
	});

	try {
		await pipeline(readable, sink);
	} finally {
		await fd.close();
	}
}
