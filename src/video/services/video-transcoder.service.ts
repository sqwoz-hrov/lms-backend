import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpegFluent from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

import { ensureFilenameExt } from '../utils/ensure-filename-extension';
import { detectVideoMime, type DetectedMime } from '../utils/detect-video-mimetype';
import { probeVideo } from '../utils/probe-video';
import { isBrowserCompatibleMp4 } from '../utils/is-browser-compatible-mp4';
import { parseHwAccel, pickVideoEncoder, type HwAccel } from '../utils/pick-video-encoder';

type EnsureOptions = {
	inputPath: string;
	originalFilename: string;
};

type EnsureResult = {
	outputPath: string;
	outputFilename: string;
	mime: string;
	didTranscode: boolean;
};

@Injectable()
export class VideoTranscoderService {
	private readonly logger = new Logger(VideoTranscoderService.name);
	private readonly targetMime = 'video/mp4';
	private readonly compatibleExtensions = new Set([
		'mov',
		'mkv',
		'm4v',
		'avi',
		'wmv',
		'flv',
		'mpeg',
		'mpg',
		'ts',
		'webm',
		'ogv',
		'3gp',
		'mxf',
		'm2ts',
	]);

	constructor() {
		// Жестко указываем бинарь ffmpeg, чтобы поведение было предсказуемым в Docker/CI.
		if (ffmpegStatic) {
			ffmpegFluent.setFfmpegPath(ffmpegStatic);
		}
	}

	async ensureBrowserCompatible(opts: EnsureOptions): Promise<EnsureResult> {
		const { inputPath, originalFilename } = opts;

		if (!fs.existsSync(inputPath)) {
			throw new Error(`Cannot transcode missing file at ${inputPath}`);
		}

		const normalizedFilename = ensureFilenameExt(originalFilename, 'mp4');

		let detected: DetectedMime | null = null;
		try {
			detected = await detectVideoMime(inputPath);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.logger.warn(`Failed to detect mime for ${inputPath}: ${message}`);
		}

		const ext = path.extname(inputPath).toLowerCase().replace('.', '');
		const isLikelyVideoExt = ext ? this.compatibleExtensions.has(ext) : false;
		const isAlreadyMp4 = detected?.mime === this.targetMime || ext === 'mp4';

		if (detected?.mime && !detected.mime.startsWith('video/')) {
			throw new Error(`Unsupported mime type for video conversion: ${detected.mime}`);
		}

		if (!detected && !isLikelyVideoExt && ext !== 'mp4') {
			throw new Error(
				`Unsupported or unrecognized video format for ${originalFilename}. Supported extensions: mp4, ${[
					...this.compatibleExtensions,
				].join(', ')}`,
			);
		}

		if (isAlreadyMp4) {
			return {
				outputPath: inputPath,
				outputFilename: normalizedFilename,
				mime: this.targetMime,
				didTranscode: false,
			};
		}

		const outputPath = this.buildOutputPath(inputPath);
		await this.runTranscodeSmart(inputPath, outputPath);

		return {
			outputPath,
			outputFilename: normalizedFilename,
			mime: this.targetMime,
			didTranscode: true,
		};
	}

	private buildOutputPath(input: string): string {
		const dir = path.dirname(input);
		const base = path.parse(input).name;
		let candidate = path.join(dir, `${base}.converted.mp4`);
		let attempt = 1;
		while (fs.existsSync(candidate)) {
			candidate = path.join(dir, `${base}.converted.${attempt}.mp4`);
			attempt += 1;
		}
		return candidate;
	}

	private async runTranscodeSmart(input: string, output: string): Promise<void> {
		const info = await probeVideo(input);

		if (isBrowserCompatibleMp4(info)) {
			await this.remuxToMp4(input, output);
			return;
		}

		const hw: HwAccel = parseHwAccel(process.env.FFMPEG_HW);
		const preset =
			process.env.FFMPEG_PRESET && process.env.FFMPEG_PRESET.length > 0 ? process.env.FFMPEG_PRESET : 'veryfast';
		const crf = process.env.FFMPEG_CRF && process.env.FFMPEG_CRF.length > 0 ? process.env.FFMPEG_CRF : '23';

		try {
			await this.transcodeToMp4(input, output, { hw, preset, crf, copyAudioIfAac: true });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.logger.warn(`Fallback to AAC transcode for audio due to error: ${msg}`);
			await this.transcodeToMp4(input, output, { hw, preset, crf, copyAudioIfAac: false });
		}
	}

	private async remuxToMp4(input: string, output: string): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			ffmpegFluent(input)
				.outputOptions(['-map 0:v:0', '-map 0:a:0?', '-c copy', '-sn', '-dn', '-movflags +faststart'])
				.format('mp4')
				.on('error', reject)
				.on('end', () => resolve())
				.save(output);
		});
	}

	private async transcodeToMp4(
		input: string,
		output: string,
		opts: { hw: HwAccel; preset: string; crf: string; copyAudioIfAac: boolean },
	): Promise<void> {
		const { vcodec, extra } = pickVideoEncoder(opts.hw);

		const base = ffmpegFluent(input).outputOptions([
			'-map 0:v:0',
			'-map 0:a:0?',
			`-c:v ${vcodec}`,
			...extra,
			`-preset ${opts.preset}`,
			`-crf ${opts.crf}`,
			'-pix_fmt yuv420p',
			'-movflags +faststart',
			'-sn',
			'-dn',
		]);

		if (opts.copyAudioIfAac) {
			base.outputOptions(['-c:a copy']);
		} else {
			base.outputOptions(['-c:a aac', '-b:a 128k']);
		}

		await new Promise<void>((resolve, reject) => {
			base
				.format('mp4')
				.on('error', reject)
				.on('end', () => resolve())
				.save(output);
		});
	}
}
