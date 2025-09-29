import * as fs from 'fs';
import * as crypto from 'crypto';

export async function sha256File(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash('sha256');
		const rs = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
		rs.on('error', reject);
		hash.on('error', reject);
		rs.on('end', () => {
			try {
				resolve(hash.digest('base64'));
			} catch (e) {
				reject(e as Error);
			}
		});
		rs.on('data', chunk => hash.update(chunk));
	});
}
