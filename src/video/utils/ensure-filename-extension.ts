import * as path from 'path';

export function ensureFilenameExt(filename: string, ext?: string): string {
	if (!ext) return filename;
	const base = path.parse(filename).name;
	return `${base}.${ext}`;
}
