import { fileTypeFromFile } from 'file-type';
import * as fs from 'fs';

export type DetectedMime = {
	mime: string;
	ext?: string;
};

export async function detectVideoMime(localPath: string): Promise<DetectedMime | null> {
	const stat = fs.statSync(localPath);
	if (!stat.isFile() || stat.size <= 0) return null;

	const type = await fileTypeFromFile(localPath);
	if (type?.mime?.startsWith('video/')) {
		return { mime: type.mime, ext: type.ext };
	}

	const fd = fs.openSync(localPath, 'r');
	try {
		const buf = Buffer.alloc(1);
		fs.readSync(fd, buf, 0, 1, 0);
		if (buf[0] === 0x47) {
			return { mime: 'video/mp2t', ext: 'ts' };
		}
	} finally {
		fs.closeSync(fd);
	}

	return null;
}
