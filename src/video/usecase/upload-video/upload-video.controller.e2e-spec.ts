import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { randomBytes } from 'crypto';
import * as sinon from 'sinon';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig, s3Config } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { UploadChunkHeaders, VideosTestSdk } from '../../test-utils/test.sdk';
import { VideoStorageService } from '../../services/video-storage.service';

describe.only('[E2E] Upload Video — resumable via MinIO (async S3, no compression)', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let videoTestSdk: VideosTestSdk;
	let jwtConf: ConfigType<typeof jwtConfig>;

	let s3: S3Client;
	let S3_HOT_BUCKET: string;
	let S3_COLD_BUCKET: string;

	let storageSvc: VideoStorageService;
	let s3UploadSpy: sinon.SinonSpy;

	/** ---------- generic helpers ---------- */
	const rangeHeader = (start: number, end: number, total: number) => `bytes ${start}-${end}/${total}`;

	async function waitFor(
		predicate: () => boolean | Promise<boolean>,
		timeoutMs = 15_000,
		intervalMs = 50,
	): Promise<void> {
		const start = Date.now();

		while (true) {
			const result = await predicate();
			if (result) return;
			if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
			await new Promise(r => setTimeout(r, intervalMs));
		}
	}

	function buildHeaders(args: {
		start: number;
		end: number;
		total: number;
		chunkSize: number;
		sessionId?: string | null;
	}) {
		const h: UploadChunkHeaders = {
			'content-range': rangeHeader(args.start, args.end, args.total),
			'upload-chunk-size': String(args.chunkSize),
		};
		if (args.sessionId) h['upload-session-id'] = args.sessionId;
		return h;
	}

	async function headObjectSize(s3: S3Client, bucket: string, key?: string): Promise<number | undefined> {
		if (!key) return undefined;
		const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
		return head.ContentLength ?? undefined;
	}

	async function findObjectOfSize(bucket: string, size: number): Promise<number | undefined> {
		const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
		if (!res.Contents?.length) return undefined;
		for (const o of res.Contents) {
			const sizeFromHead = await headObjectSize(s3, bucket, o.Key);
			if (sizeFromHead === size) return sizeFromHead;
		}
		return undefined;
	}

	async function clearBucket(s3: S3Client, bucket: string): Promise<void> {
		try {
			let token: string | undefined;
			do {
				const list = await s3.send(
					new ListObjectsV2Command({ Bucket: bucket, ...(token && { ContinuationToken: token }) }),
				);
				if (!list.Contents?.length) break;
				for (const o of list.Contents) {
					if (!o.Key) continue;
					try {
						await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: o.Key }));
					} catch (e) {
						// don't fail teardown on a single delete error
						console.warn(`Failed to delete object ${o.Key}:`, e);
					}
				}
				token = list.NextContinuationToken;
			} while (token);
		} catch (err: any) {
			if (err?.name === 'NoSuchBucket') return;
			throw err;
		}
	}

	/** Upload one raw (uncompressed) chunk with consistent headers */
	async function uploadChunkRaw(opts: {
		filename: string;
		file: Buffer;
		start: number;
		end: number;
		total: number;
		userMeta: { userId: string; isAuth: boolean; isWrongAccessJwt: boolean };
		sessionId?: string | null;
	}) {
		return videoTestSdk.uploadChunk({
			params: {
				file: opts.file,
				filename: opts.filename,
				start: opts.start,
				end: opts.end,
				totalSize: opts.total,
			},
			userMeta: opts.userMeta,
			headers: buildHeaders({
				start: opts.start,
				end: opts.end,
				total: opts.total,
				chunkSize: opts.file.length,
				sessionId: opts.sessionId,
			}),
		});
	}

	/** Wait for async S3 path to trigger, then assert both hot/cold contain object with expected size */
	async function expectAsyncUploadFinishedWithSize(expectedSize: number) {
		await waitFor(() => s3UploadSpy.callCount >= 1);
		let hot: number | undefined;
		let cold: number | undefined;

		await waitFor(
			async () => {
				[hot, cold] = await Promise.all([
					findObjectOfSize(S3_HOT_BUCKET, expectedSize),
					findObjectOfSize(S3_COLD_BUCKET, expectedSize),
				]);
				return hot === expectedSize && cold === expectedSize;
			},
			25_000,
			200,
		);

		expect(hot, 'hot object size').to.equal(expectedSize);
		expect(cold, 'cold object size').to.equal(expectedSize);
	}

	/** Split random buffer into 2 parts (no compression) */
	function twoPartPlain(size: number, splitAt?: number) {
		const plain = randomBytes(size);
		const m = splitAt ?? Math.floor(size / 2);
		const part1 = plain.subarray(0, m);
		const part2 = plain.subarray(m);
		return {
			part1,
			part2,
			total: plain.length,
		};
	}

	/** ---------- mocha lifecycle ---------- */
	before(function (this: ISharedContext) {
		app = this.app;

		const kysely = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(kysely);

		jwtConf = app.get(jwtConfig.KEY);
		videoTestSdk = new VideosTestSdk(new TestHttpClient({ port: 3000, host: 'http://127.0.0.1' }, jwtConf));

		const s3Conf = app.get<ConfigType<typeof s3Config>>(s3Config.KEY);
		S3_HOT_BUCKET = s3Conf.videosHotBucketName;
		S3_COLD_BUCKET = s3Conf.videosColdBucketName;

		s3 = new S3Client({
			endpoint: s3Conf.endpoint,
			region: s3Conf.region,
			credentials: {
				accessKeyId: s3Conf.accessKeyId,
				secretAccessKey: s3Conf.secretAccessKey,
			},
		});

		// spy on the service that triggers S3 upload (async after HTTP response)
		storageSvc = app.get(VideoStorageService);
		s3UploadSpy = sinon.spy(storageSvc, 'findOrUploadByChecksum');
	});

	afterEach(() => {
		s3UploadSpy.resetHistory();
	});

	after(async () => {
		await usersRepo.clearAll();
		await clearBucket(s3, S3_HOT_BUCKET);
		await clearBucket(s3, S3_COLD_BUCKET);
		s3UploadSpy.restore();
	});

	/** ---------- tests ---------- */

	it('rejects unauthorized user (401)', async () => {
		const user = await createTestUser(usersRepo);
		const buf = randomBytes(1024 * 1024);

		const res = await uploadChunkRaw({
			filename: 'unauth.bin',
			file: buf,
			start: 0,
			end: buf.length - 1,
			total: buf.length,
			userMeta: { userId: user.id, isAuth: false, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
		expect(s3UploadSpy.called).to.equal(false);
	});

	it('happy path: uploads a single raw chunk; waits for async S3 upload', async function () {
		const admin = await createTestAdmin(usersRepo);

		const plain = Buffer.from(randomBytes(8 * 1024 * 1024));

		const res = await uploadChunkRaw({
			filename: 'happy.bin',
			file: plain,
			start: 0,
			end: plain.length - 1,
			total: plain.length,
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		// Controller responds immediately; usecase kicks off hashing+S3 upload asynchronously
		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.headers.get('upload-length')).to.equal(String(plain.length));
		expect(res.headers.get('upload-offset')).to.equal(String(plain.length));
		expect(res.headers.get('location')).to.be.a('string');

		await expectAsyncUploadFinishedWithSize(plain.length);
	});

	it('resumes upload after client interruption (2 raw chunks); waits for async S3 upload', async function () {
		const admin = await createTestAdmin(usersRepo);

		const { part1, part2, total } = twoPartPlain(10 * 1024 * 1024);

		// chunk #1
		const res1 = await uploadChunkRaw({
			filename: 'resume.bin',
			file: part1,
			start: 0,
			end: part1.length - 1,
			total,
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});
		expect(res1.status).to.equal(HttpStatus.NO_CONTENT);
		expect(res1.headers.get('upload-offset')).to.equal(String(part1.length));
		const sessionId = res1.headers.get('upload-session-id') as string;
		expect(sessionId).to.be.a('string');
		expect(s3UploadSpy.called).to.equal(false);

		// chunk #2
		const res2 = await uploadChunkRaw({
			filename: 'resume.bin',
			file: part2,
			start: part1.length,
			end: total - 1,
			total,
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			sessionId,
		});
		expect(res2.status).to.equal(HttpStatus.CREATED);
		expect(res2.headers.get('upload-offset')).to.equal(String(total));
		expect(res2.headers.get('upload-length')).to.equal(String(total));
		expect(res2.headers.get('location')).to.be.a('string');

		await expectAsyncUploadFinishedWithSize(total);
	});

	it('does not start S3 upload until temp file is complete (raw)', async function () {
		const admin = await createTestAdmin(usersRepo);

		const { part1, part2, total } = twoPartPlain(6 * 1024 * 1024, Math.floor((6 * 1024 * 1024 * 2) / 3));

		// part 1
		const res1 = await uploadChunkRaw({
			filename: 'not-yet.bin',
			file: part1,
			start: 0,
			end: part1.length - 1,
			total,
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});
		expect(res1.status).to.equal(HttpStatus.NO_CONTENT);
		expect(res1.headers.get('upload-offset')).to.equal(String(part1.length));
		const sessionId = res1.headers.get('upload-session-id') as string;
		expect(s3UploadSpy.called).to.equal(false);

		// part 2 completes the temp file
		const res2 = await uploadChunkRaw({
			filename: 'not-yet.bin',
			file: part2,
			start: part1.length,
			end: total - 1,
			total,
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			sessionId,
		});
		expect(res2.status).to.equal(HttpStatus.CREATED);
		expect(res2.headers.get('upload-offset')).to.equal(String(total));

		await expectAsyncUploadFinishedWithSize(total);
	});
});
