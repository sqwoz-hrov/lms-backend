import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import { VideoRepository } from '../../video.repoistory';
import { WorkflowRunnerService } from '../../services/workflow-runner.service';
import { calcOffsetFromRanges } from '../../utils/calc-offset-from-ranges';
import type { Video } from '../../video.entity';

@Injectable()
export class ResumeUploadsUsecase implements OnModuleInit {
	private readonly logger = new Logger(ResumeUploadsUsecase.name);

	constructor(
		private readonly videoRepo: VideoRepository,
		private readonly runner: WorkflowRunnerService,
	) {}

	onModuleInit(): void {
		this.resumeAllStuck().catch(err => {
			this.logger.error('Failed to kick off resumeAllStuck()', err?.stack || String(err));
		});
	}

	private async resumeAllStuck(): Promise<void> {
		const converting = await this.videoRepo.find({ phase: 'converting' });
		const hashing = await this.videoRepo.find({ phase: 'hashing' });
		const uploading = await this.videoRepo.find({ phase: 'uploading_s3' });
		const receiving = await this.videoRepo.find({ phase: 'receiving' });

		const fullyReceived = receiving.filter(
			v => calcOffsetFromRanges(v.uploaded_ranges) === Number(v.total_size) && v.tmp_path && fs.existsSync(v.tmp_path),
		);

		const stuck: Video[] = [...converting, ...hashing, ...uploading, ...fullyReceived];

		if (!stuck.length) {
			this.logger.log('No stuck uploads to resume.');
			return;
		}

		this.logger.log(`Resuming ${stuck.length} upload(s)...`);

		const parallel = 2;
		const batches: Video[][] = [];
		for (let i = 0; i < stuck.length; i += parallel) {
			batches.push(stuck.slice(i, i + parallel));
		}

		for (const batch of batches) {
			await Promise.all(
				batch.map(async v => {
					try {
						await this.runner.advance(v.id);
					} catch (err) {
						this.logger.error(
							`Resume advance() failed for video ${v.id} (phase=${v.phase})`,
							err?.stack || String(err),
						);
					}
				}),
			);
		}

		this.logger.log('Resume pass finished.');
	}
}
