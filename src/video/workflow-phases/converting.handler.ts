import type { PhaseCompensateContext, PhaseHandleResult, PhaseHandler } from '../ports/phase-handler';
import type { Video } from '../video.entity';
import * as fs from 'fs';
import { VideoRepository } from '../video.repoistory';
import { VideoTranscoderService } from '../services/video-transcoder.service';

export class ConvertingHandler implements PhaseHandler {
	constructor(
		private readonly videoRepo: VideoRepository,
		private readonly transcoder: VideoTranscoderService,
	) {}

	async handle(video: Video): Promise<PhaseHandleResult> {
		if (!video.tmp_path || !fs.existsSync(video.tmp_path)) {
			throw new Error(`Tmp file missing for compression (video ${video.id})`);
		}

		await this.transcoder.extractTranscriptionAudio({
			inputPath: video.tmp_path,
		});
		const result = await this.transcoder.ensureBrowserCompatible({
			inputPath: video.tmp_path,
			originalFilename: video.filename,
		});

		const stats = fs.statSync(result.outputPath);

		await this.videoRepo.update(video.id, {
			user_id: video.user_id,
			filename: result.outputFilename,
			mime_type: result.mime,
			total_size: String(stats.size),
			converted_tmp_path: result.outputPath,
		});

		if (result.didTranscode && result.outputPath !== video.tmp_path && fs.existsSync(video.tmp_path)) {
			fs.unlinkSync(video.tmp_path);
		}

		return { kind: 'advance', nextPhase: 'hashing' };
	}

	compensate(video: Video, _error: Error, _context: PhaseCompensateContext): void {
		const candidates = new Set<string>();
		if (video.converted_tmp_path) {
			candidates.add(video.converted_tmp_path);
		}
		if (video.tmp_path) {
			candidates.add(this.transcoder.buildTranscriptionAudioOutputPath(video.tmp_path));
		}

		for (const filePath of candidates) {
			try {
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			} catch {
				// Best-effort cleanup only.
			}
		}
	}
}
