import * as fs from 'fs';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';

export async function compressToGzip(srcPath: string, gzPath: string): Promise<number> {
	const gzip = zlib.createGzip();
	await pipeline(fs.createReadStream(srcPath), gzip, fs.createWriteStream(gzPath));
	return fs.statSync(gzPath).size;
}
