import { BadRequestException, Injectable } from '@nestjs/common';
import type { Readable } from 'stream';
import { writeStreamAtPosition } from '../utils/write-stream-at-position';

export type FileChunkWriteInput = {
	body: Readable;
	tmpPath: string;
	start: number;
	end: number;
	totalSize: number;
	length?: number;
};

@Injectable()
export class ChunkUploadService {
	async writeChunkAt(input: FileChunkWriteInput) {
		const { body, tmpPath, start, end, totalSize, length } = input;

		if (!(end >= start)) throw new BadRequestException('Invalid range (end < start)');
		if (start < 0 || end >= totalSize) throw new BadRequestException('Range out of bounds');

		const expectedLen = end - start + 1;
		if (length != null && length !== expectedLen) {
			throw new BadRequestException('Chunk length mismatch');
		}

		await writeStreamAtPosition(body, tmpPath, start, expectedLen);
	}
}
