import * as fs from 'fs';
import { allocateGzipTmpPath } from './allocate-gzip-tmp-path';

export async function ensureGzipTmpPath(
	currentPath: string | null | undefined,
	persist: (newPath: string) => Promise<void>,
): Promise<string> {
	const gzPath = currentPath || allocateGzipTmpPath();
	if (!currentPath) await persist(gzPath);
	if (!fs.existsSync(gzPath)) fs.closeSync(fs.openSync(gzPath, 'w'));
	return gzPath;
}
