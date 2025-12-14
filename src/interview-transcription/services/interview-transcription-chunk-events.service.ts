import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { REDIS_CONNECTION_KEY } from '../../infra/redis.const';
import { InterviewTranscriptionChunkEvent } from '../../sse/sse.events';
import { SseService } from '../../sse/sse.service';
import { VideoRepository } from '../../video/video.repoistory';

const QUEUE_NAME = 'interview-transcription-chunks';

type InterviewTranscriptionChunkJob = Job<InterviewTranscriptionChunkEvent, void>;

@Injectable()
export class InterviewTranscriptionChunkEventsService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(InterviewTranscriptionChunkEventsService.name);
	private worker?: Worker<InterviewTranscriptionChunkEvent, void>;

	constructor(
		@Inject(REDIS_CONNECTION_KEY)
		private readonly redisClient: Redis,
		private readonly videoRepository: VideoRepository,
		private readonly sseService: SseService,
	) {}

	onModuleInit(): void {
		this.logger.log('Initializing interview transcription chunk worker');
		const connectionOptions = this.redisClient.options;
		this.worker = new Worker<InterviewTranscriptionChunkEvent, void>(QUEUE_NAME, job => this.handleChunk(job), {
			connection: connectionOptions,
			skipWaitingForReady: true,
		});

		this.worker.on('error', error => {
			this.logger.error('Interview transcription chunk worker error', error instanceof Error ? error.stack : undefined);
		});
	}

	async onModuleDestroy(): Promise<void> {
		if (!this.worker) {
			return;
		}

		this.logger.log('Shutting down interview transcription chunk worker');
		await this.worker.close();
	}

	private async handleChunk(job: InterviewTranscriptionChunkJob): Promise<void> {
		try {
			const { videoId } = job.data;
			const video = await this.videoRepository.findById(videoId);
			if (!video) {
				this.logger.warn(`Video ${videoId} referenced in job ${job.id} not found`);
				return;
			}

			const delivered = this.sseService.sendEvent(video.user_id, 'interview-transcription-chunk', job.data);
			if (!delivered) {
				this.logger.debug(`No SSE subscribers while delivering chunk update for user ${video.user_id}`);
			}
		} catch (error) {
			this.logger.error(
				`Failed to handle interview transcription chunk job ${job.id}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
