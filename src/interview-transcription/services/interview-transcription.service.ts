import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	OnModuleDestroy,
	OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { InterviewTranscriptionRepository } from '../interview-transcription.repository';
import { VmOrchestratorAdapter, VM_ORCHESTRATOR_ADAPTER } from '../ports/vm-orchestrator.adapter';
import { VideoRepository } from '../../video/video.repoistory';
import { InterviewTranscription } from '../interview-transcription.entity';
import { REDIS_CONNECTION_KEY } from '../../infra/redis.const';

type InterviewTranscriptionJobPayload = {
	storageKey: string;
	videoId: string;
	interviewTranscriptionId: string;
};

const QUEUE_NAME = 'interview-transcription';
const JOB_NAME = 'process-interview-transcription';

@Injectable()
export class InterviewTranscriptionService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(InterviewTranscriptionService.name);
	private queue: Queue<InterviewTranscriptionJobPayload, void, typeof JOB_NAME>;

	constructor(
		private readonly transcriptionRepository: InterviewTranscriptionRepository,
		private readonly videoRepository: VideoRepository,
		@Inject(REDIS_CONNECTION_KEY)
		private readonly redisClient: Redis,
		@Inject(VM_ORCHESTRATOR_ADAPTER)
		private readonly vmAdapter: VmOrchestratorAdapter,
	) {}

	async onModuleInit(): Promise<void> {
		this.logger.log('InterviewTranscriptionService module init started');
		// BullMQ starts connecting immediately (lazyConnect does not help), so we are initializing the queue in OnModuleInit to avoid ugly logs in e2e tests
		this.queue = new Queue<InterviewTranscriptionJobPayload, void, typeof JOB_NAME>(QUEUE_NAME, {
			connection: this.redisClient,
			skipWaitingForReady: true,
		});
		this.logger.log(`Queue ${QUEUE_NAME} initialized`);
		try {
			await this.enqueuePendingTranscriptions();
		} catch (error) {
			this.logger.error(
				'Failed to schedule pending transcriptions on startup',
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async onModuleDestroy(): Promise<void> {
		this.logger.log('InterviewTranscriptionService module destroy started');
		await this.queue.close();
		this.logger.log(`Queue ${QUEUE_NAME} closed`);
	}

	async enqueuePendingTranscriptions(): Promise<void> {
		const pending = await this.transcriptionRepository.findByStatus('created');
		if (pending.length === 0) {
			return;
		}

		this.logger.log(`Found ${pending.length} interview transcriptions waiting to be scheduled`);
		for (const transcription of pending) {
			try {
				await this.enqueueTranscription(transcription.id);
			} catch (error) {
				this.logger.error(
					`Failed to enqueue transcription ${transcription.id}: ${error instanceof Error ? error.message : error}`,
				);
			}
		}
	}

	async enqueueTranscription(interviewTranscriptionId: string): Promise<InterviewTranscription> {
		this.logger.debug(`Attempting to enqueue transcription ${interviewTranscriptionId}`);
		const transcription = await this.transcriptionRepository.findById(interviewTranscriptionId);
		if (!transcription) {
			throw new NotFoundException('Запись транскрибации интервью не найдена');
		}
		if (transcription.status !== 'created') {
			this.logger.debug(`Transcription ${interviewTranscriptionId} is already ${transcription.status}, skipping`);
			return transcription;
		}

		const video = await this.videoRepository.findById(transcription.video_id);
		if (!video) {
			throw new NotFoundException('Видео для транскрибации не найдено');
		}

		if (!video.storage_key) {
			throw new BadRequestException('Видеофайл еще не загружен в хранилище');
		}

		await this.ensureVmRunning();
		await this.queue.add(
			JOB_NAME,
			{ storageKey: video.storage_key, videoId: video.id, interviewTranscriptionId },
			{ removeOnComplete: true, removeOnFail: false },
		);
		this.logger.log(`Transcription ${interviewTranscriptionId} queued for processing`);

		const updated = await this.transcriptionRepository.markProcessing(interviewTranscriptionId);
		if (!updated) {
			this.logger.warn(`Failed to mark transcription ${interviewTranscriptionId} as processing`);
		} else {
			this.logger.debug(`Transcription ${interviewTranscriptionId} marked as processing`);
		}
		return updated ?? transcription;
	}

	async handleTranscriptionFinished(): Promise<void> {
		this.logger.debug('handleTranscriptionFinished invoked');
		const processingCount = await this.transcriptionRepository.countByStatus('processing');
		if (processingCount > 0) {
			this.logger.debug(`Still ${processingCount} transcription(s) processing, keeping VM running`);
			return;
		}

		try {
			await this.vmAdapter.stopVm();
			this.logger.log('No active transcriptions left, VM stop requested');
		} catch (error) {
			this.logger.error(
				'Failed to stop VM after finishing transcriptions',
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	private async ensureVmRunning(): Promise<void> {
		this.logger.debug('Ensuring VM is running for interview transcription');
		try {
			const status = await this.vmAdapter.getVmStatus();
			if (status?.powerState === 'running') {
				this.logger.debug(`VM ${status.id ?? ''} already running`);
				return;
			}
		} catch (error) {
			this.logger.warn(
				`Failed to read VM status before starting: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		await this.vmAdapter.startVm();
		this.logger.log('VM start requested for interview transcription');
	}
}
