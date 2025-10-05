import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { DEFAULT_TMP_DIR } from './constants';

export function allocateTmpPath(): string {
	const baseDir = process.env.VIDEO_UPLOAD_TMP_DIR || DEFAULT_TMP_DIR;
	fs.mkdirSync(baseDir, { recursive: true });
	const p = path.join(baseDir, `${crypto.randomUUID()}.part`);
	fs.closeSync(fs.openSync(p, 'w'));
	return p;
}
