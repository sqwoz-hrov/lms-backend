import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import * as ffmpeg from 'ffmpeg-static';

export type RealVideoKind = 'mp4' | 'mkv' | 'mov' | 'webm' | 'ts';

type Recipe = {
	// ffmpeg args to synthesize a tiny, valid container with video (+ optional audio)
	args: string[];
	// Suggested file extension (same as kind)
	ext: string;
};

// Base directory to cache fixtures across test runs
const CACHE_DIR = join(process.cwd(), 'node_modules', '.cache', 'video-fixtures');

function ensureCacheDir() {
	mkdirSync(CACHE_DIR, { recursive: true });
}

// Minimal, fast recipes per container (video: 0.7s, 320x180)
const RECIPES: Record<RealVideoKind, Recipe> = {
	// H.264 + AAC in MP4
	mp4: {
		ext: 'mp4',
		args: [
			'-y',
			// synthetic video (color) 0.7s @25fps
			'-f',
			'lavfi',
			'-i',
			'color=c=black:s=320x180:d=0.7:r=25',
			// synthetic audio (silence)
			'-f',
			'lavfi',
			'-i',
			'anullsrc=r=48000:cl=stereo',
			'-shortest',
			'-pix_fmt',
			'yuv420p',
			'-vcodec',
			'libx264',
			'-preset',
			'veryfast',
			'-tune',
			'zerolatency',
			'-movflags',
			'+faststart',
			'-acodec',
			'aac',
			'-b:a',
			'64k',
		],
	},
	// H.264 + AAC in MOV
	mov: {
		ext: 'mov',
		args: [
			'-y',
			'-f',
			'lavfi',
			'-i',
			'color=c=black:s=320x180:d=0.7:r=25',
			'-f',
			'lavfi',
			'-i',
			'anullsrc=r=48000:cl=stereo',
			'-shortest',
			'-pix_fmt',
			'yuv420p',
			'-vcodec',
			'libx264',
			'-preset',
			'veryfast',
			'-tune',
			'zerolatency',
			'-acodec',
			'aac',
			'-b:a',
			'64k',
			// контейнер сам по себе mov
		],
	},
	// H.264 in MPEG-TS (без аудио для простоты)
	ts: {
		ext: 'ts',
		args: [
			'-y',
			'-f',
			'lavfi',
			'-i',
			'color=c=black:s=320x180:d=0.7:r=25',
			'-pix_fmt',
			'yuv420p',
			'-vcodec',
			'libx264',
			'-preset',
			'veryfast',
			'-tune',
			'zerolatency',
			'-f',
			'mpegts',
		],
	},
	// VP9 + Opus в WebM
	webm: {
		ext: 'webm',
		args: [
			'-y',
			'-f',
			'lavfi',
			'-i',
			'color=c=black:s=320x180:d=0.7:r=25',
			'-f',
			'lavfi',
			'-i',
			'anullsrc=r=48000:cl=stereo',
			'-shortest',
			'-pix_fmt',
			'yuv420p',
			'-c:v',
			'libvpx-vp9',
			'-b:v',
			'256k',
			'-c:a',
			'libopus',
			'-b:a',
			'64k',
		],
	},
	// H.264 + AAC в MKV (matroska всеядный)
	mkv: {
		ext: 'mkv',
		args: [
			'-y',
			'-f',
			'lavfi',
			'-i',
			'color=c=black:s=320x180:d=0.7:r=25',
			'-f',
			'lavfi',
			'-i',
			'anullsrc=r=48000:cl=stereo',
			'-shortest',
			'-pix_fmt',
			'yuv420p',
			'-vcodec',
			'libx264',
			'-preset',
			'veryfast',
			'-tune',
			'zerolatency',
			'-acodec',
			'aac',
			'-b:a',
			'64k',
			// matroska/mkv контейнер выставит по расширению
		],
	},
};

function ffmpegPath() {
	if (!ffmpeg) {
		throw new Error('ffmpeg-static not found. Add devDependency: npm i -D ffmpeg-static');
	}
	return ffmpeg;
}

function cachedPath(kind: RealVideoKind, key = 'v320x180_d0p7'): string {
	const { ext } = RECIPES[kind];
	return join(CACHE_DIR, `${kind}_${key}.${ext}`);
}

/**
 * Generate (if missing) and load a realistic sample file for the given container.
 * Returns the Buffer and absolute path (in case the caller wants a stream).
 */
export function makeRealVideo(kind: RealVideoKind): { buffer: Buffer; path: string } {
	ensureCacheDir();
	const outPath = cachedPath(kind);

	if (!existsSync(outPath)) {
		const tmpOut = join(tmpdir(), `vid-${process.pid}-${Date.now()}.${RECIPES[kind].ext}`);
		const args = [...RECIPES[kind].args, tmpOut];

		const { status, error, stderr } = spawnSync(ffmpegPath() as unknown as string, args, {
			stdio: ['ignore', 'ignore', 'pipe'],
		});
		if (status !== 0) {
			const errMsg = Buffer.isBuffer(stderr) ? stderr.toString('utf8') : String(stderr);
			throw new Error(`ffmpeg failed for ${kind}: ${errMsg} ${error ? `(${error.message})` : ''}`);
		}

		// Move into cache (atomic enough for tests)
		const data = readFileSync(tmpOut);
		writeFileSync(outPath, data);
	}

	const buffer = readFileSync(outPath);
	return { buffer, path: outPath };
}

/** Convenience: return only Buffer */
export function makeRealVideoBuffer(kind: RealVideoKind): Buffer {
	return makeRealVideo(kind).buffer;
}

/** Split a real media file into 2 parts (by absolute byte offset or half) */
export function twoPartReal(kind: RealVideoKind, splitAt?: number) {
	const buf = makeRealVideoBuffer(kind);
	const m = splitAt ?? Math.floor(buf.length / 2);
	const part1 = buf.subarray(0, m);
	const part2 = buf.subarray(m);
	return { part1, part2, total: buf.length };
}

/** Map kind -> preferred filename extension */
export function extFor(kind: RealVideoKind): string {
	return `.${RECIPES[kind].ext}`;
}
