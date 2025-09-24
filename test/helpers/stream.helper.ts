import { Readable } from 'stream';

export function createChunkedStream({
	chunks = 80,
	chunkBytes = 1024,
	delayMs = 4,
	fill = 0x61,
}: {
	chunks?: number;
	chunkBytes?: number;
	delayMs?: number;
	fill?: number;
} = {}): { stream: Readable; totalBytes: number; onEnd: Promise<number> } {
	const totalBytes = chunks * chunkBytes;

	let resolveEnd!: (t: number) => void;
	const onEnd = new Promise<number>(r => (resolveEnd = r));

	async function* gen() {
		for (let i = 0; i < chunks; i++) {
			yield Buffer.alloc(chunkBytes, fill);
			if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
		}
		resolveEnd(Date.now());
	}

	return { stream: Readable.from(gen()), totalBytes, onEnd };
}
