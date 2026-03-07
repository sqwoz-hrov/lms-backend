import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { get } from 'env-var';
import * as fs from 'fs';
import { Kysely, PostgresDialect } from 'kysely';
import * as os from 'os';
import * as path from 'path';
import { Pool } from 'pg';
import { pipeline } from 'stream/promises';
import { VideoTranscoderService } from '../services/video-transcoder.service';
import { buildTranscriptionAudioStorageKey } from '../utils/transcription-audio-key';

type VideoRow = {
	id: string;
	user_id: string;
	storage_key: string;
};

type VideoTable = {
	id: string;
	user_id: string;
	phase: string;
	storage_key: string | null;
	transcription_audio_storage_key: string | null;
};

type DB = { video: VideoTable };

const config = {
	db: {
		host: get('POSTGRES_HOST').required().asString(),
		port: get('POSTGRES_PORT').required().asPortNumber(),
		user: get('POSTGRES_USER').required().asString(),
		password: get('POSTGRES_PASSWORD').required().asString(),
		database: get('POSTGRES_DB').required().asString(),
	},
	s3: {
		accessKeyId: get('S3_SECRET_KEY_ID').required().asString(),
		secretAccessKey: get('S3_SECRET_KEY').required().asString(),
		region: get('S3_REGION').required().asString(),
		endpoint: get('S3_ENDPOINT').required().asString(),
		videosHotBucketName: get('S3_VIDEOS_HOT_BUCKET_NAME').required().asString(),
		transcriptionAudioBucketName: get('S3_TRANSCRIPTION_AUDIO_BUCKET_NAME').required().asString(),
		forcePathStyle: get('S3_FORCE_PATH_STYLE').default('true').asBool(),
	},
	batchSize: get('BACKFILL_BATCH_SIZE').default('50').asIntPositive(),
	concurrency: get('BACKFILL_CONCURRENCY').default('4').asIntPositive(),
};

async function main(): Promise<void> {
	const pool = new Pool(config.db);
	const db = new Kysely<DB>({
		dialect: new PostgresDialect({ pool }),
	});
	const s3 = new S3Client({
		region: config.s3.region,
		endpoint: config.s3.endpoint,
		forcePathStyle: config.s3.forcePathStyle,
		credentials: {
			accessKeyId: config.s3.accessKeyId,
			secretAccessKey: config.s3.secretAccessKey,
		},
	});
	const transcoder = new VideoTranscoderService();

	let successCount = 0;
	let failCount = 0;

	try {
		console.log(
			`Starting transcription-audio backfill (batchSize=${config.batchSize}, concurrency=${config.concurrency})`,
		);
		for (;;) {
			const rows = await db
				.selectFrom('video')
				.select(['id', 'user_id', 'storage_key'])
				.where('phase', '=', 'completed')
				.where('storage_key', 'is not', null)
				.where('transcription_audio_storage_key', 'is', null)
				.limit(config.batchSize)
				.execute();

			if (rows.length === 0) {
				break;
			}

			const work: VideoRow[] = rows.map(row => ({
				id: row.id,
				user_id: row.user_id,
				storage_key: row.storage_key as string,
			}));

			const outcomes = await runWithConcurrency(work, config.concurrency, async row => {
				await processVideo({ row, db, s3, transcoder });
			});

			for (const outcome of outcomes) {
				if (outcome.ok) {
					successCount += 1;
				} else {
					failCount += 1;
					console.error(outcome.error);
				}
			}
		}

		console.log(`Backfill completed. Success=${successCount} Failed=${failCount}`);
		if (failCount > 0) {
			process.exitCode = 1;
		}
	} finally {
		await db.destroy();
	}
}

async function processVideo(args: {
	row: VideoRow;
	db: Kysely<DB>;
	s3: S3Client;
	transcoder: VideoTranscoderService;
}): Promise<void> {
	const { row, db, s3, transcoder } = args;
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `transcription-audio-backfill-${row.id}-`));
	const localSource = path.join(tmpDir, 'source-video.bin');

	try {
		const sourceObject = await s3.send(
			new GetObjectCommand({
				Bucket: config.s3.videosHotBucketName,
				Key: row.storage_key,
			}),
		);

		if (!sourceObject.Body) {
			throw new Error(`Empty body for video ${row.id} key=${row.storage_key}`);
		}

		await pipeline(sourceObject.Body as NodeJS.ReadableStream, fs.createWriteStream(localSource));
		const extracted = await transcoder.extractTranscriptionAudio({ inputPath: localSource });

		const audioKey = buildTranscriptionAudioStorageKey(row.id);
		const audioUpload = new Upload({
			client: s3,
			params: {
				Bucket: config.s3.transcriptionAudioBucketName,
				Key: audioKey,
				Body: fs.createReadStream(extracted.outputPath),
				ContentType: 'audio/wav',
				ACL: 'private',
				Metadata: { userId: row.user_id },
			},
		});
		await audioUpload.done();

		await db
			.updateTable('video')
			.set({ transcription_audio_storage_key: audioKey })
			.where('id', '=', row.id)
			.where('transcription_audio_storage_key', 'is', null)
			.executeTakeFirst();

		console.log(`Backfilled video ${row.id}`);
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}

async function runWithConcurrency<T>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<void>,
): Promise<Array<{ ok: true } | { ok: false; error: string }>> {
	const results = new Array<{ ok: true } | { ok: false; error: string }>(items.length);
	let index = 0;

	const runWorker = async () => {
		for (;;) {
			const nextIndex = index;
			index += 1;
			if (nextIndex >= items.length) return;

			try {
				await worker(items[nextIndex]);
				results[nextIndex] = { ok: true };
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				results[nextIndex] = { ok: false, error: `Failed to backfill item ${nextIndex}: ${message}` };
			}
		}
	};

	const workers = Array.from({ length: Math.max(1, concurrency) }, () => runWorker());
	await Promise.all(workers);
	return results;
}

void main();
