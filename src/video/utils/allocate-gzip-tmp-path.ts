import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { DEFAULT_GZIP_TMP_DIR } from './constants';

export function allocateGzipTmpPath(): string {
	const baseDir = process.env.VIDEO_GZIP_TMP_DIR || DEFAULT_GZIP_TMP_DIR;
	fs.mkdirSync(baseDir, { recursive: true });
	const p = path.join(baseDir, `${crypto.randomUUID()}.gz`);
	fs.closeSync(fs.openSync(p, 'w'));
	return p;
}
