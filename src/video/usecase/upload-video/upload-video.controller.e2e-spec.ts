import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { extFor, makeRealVideoBuffer, twoPartReal } from '../../../../test/fixtures/video.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig, s3Config } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { VideoStorageService } from '../../services/video-storage.service';
import { VideosTestRepository } from '../../test-utils/test.repo';
import { UploadChunkHeaders, VideosTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Upload Video — resumable via MinIO (async S3, no compression)', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let videoTestRepo: VideosTestRepository;
	let videoTestSdk: VideosTestSdk;
	let jwtConf: ConfigType<typeof jwtConfig>;

	let s3: S3Client;
	let S3_HOT_BUCKET: string;
	let S3_COLD_BUCKET: string;

	let storageSvc: VideoStorageService;
	let s3UploadSpy: sinon.SinonSpy;

	const rangeHeader = (start: number, end: number, total: number) => `bytes ${start}-${end}/${total}`;

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

	type LocatedS3Object = {
		key: string;
		size: number;
		contentType?: string;
	};

	async function headObjectInfo(s3: S3Client, bucket: string, key?: string): Promise<LocatedS3Object | undefined> {
		if (!key) return undefined;
		const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
		const size = typeof head.ContentLength === 'number' ? head.ContentLength : Number(head.ContentLength ?? 0);
		return {
			key,
			size,
			contentType: head.ContentType ?? undefined,
		};
	}

	async function waitForStorageKey(videoId: string, opts?: { timeoutMs?: number; intervalMs?: number }) {
		const timeoutMs = opts?.timeoutMs ?? 15_000;
		const intervalMs = opts?.intervalMs ?? 250;
		const startedAt = Date.now();

		for (;;) {
			const video = await videoTestRepo.findById(videoId);
			if (video?.storage_key) return video;
			if (Date.now() - startedAt > timeoutMs) {
				throw new Error(`Timed out waiting for storage_key on video ${videoId}`);
			}
			await new Promise(resolve => setTimeout(resolve, intervalMs));
		}
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

	before(function (this: ISharedContext) {
		app = this.app;

		const kysely = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(kysely);
		videoTestRepo = new VideosTestRepository(kysely);

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

		storageSvc = app.get(VideoStorageService);
		s3UploadSpy = sinon.spy(storageSvc, 'findOrUploadByChecksum');
	});

	afterEach(() => {
		s3UploadSpy.resetHistory();
	});

	after(async () => {
		await usersRepo.clearAll();
		await videoTestRepo.clearAll();
		await clearBucket(s3, S3_HOT_BUCKET);
		await clearBucket(s3, S3_COLD_BUCKET);
		s3UploadSpy.restore();
	});

	it('rejects unauthorized user (401)', async () => {
		const user = await createTestUser(usersRepo);

		const buf = makeRealVideoBuffer('mkv');
		const res = await uploadChunkRaw({
			filename: 'unauth' + extFor('mkv'),
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

		const plain = makeRealVideoBuffer('mp4');
		const res = await uploadChunkRaw({
			filename: 'happy' + extFor('mp4'),
			file: plain,
			start: 0,
			end: plain.length - 1,
			total: plain.length,
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status != 201) throw new Error();
		expect(res.headers.get('upload-length')).to.equal(String(plain.length));
		expect(res.headers.get('upload-offset')).to.equal(String(plain.length));
		expect(res.headers.get('location')).to.be.a('string');

		const createdId = res.body.id;
		expect(createdId).to.be.a('string');

		const storedVideo = await waitForStorageKey(createdId);
		expect(storedVideo).to.be.an('object');

		const storageKey = storedVideo?.storage_key ?? undefined;
		expect(storageKey).to.be.a('string');

		const hotObject = await headObjectInfo(s3, S3_HOT_BUCKET, storageKey);
		expect(hotObject).to.be.an('object');
		expect(hotObject?.contentType).to.equal('video/mp4');
	});

	it('resumes upload after client interruption (2 raw chunks); waits for async S3 upload', async function () {
		const admin = await createTestAdmin(usersRepo);

		const { part1, part2, total } = twoPartReal('mkv');
		const res1 = await uploadChunkRaw({
			filename: 'resume' + extFor('mkv'),
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

		const res2 = await uploadChunkRaw({
			filename: 'resume' + extFor('mkv'),
			file: part2,
			start: part1.length,
			end: total - 1,
			total,
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			sessionId,
		});
		expect(res2.status).to.equal(HttpStatus.OK);
		if (res2.status != 200) throw new Error();
		expect(res2.headers.get('upload-offset')).to.equal(String(total));
		expect(res2.headers.get('upload-length')).to.equal(String(total));
		expect(res2.headers.get('location')).to.be.a('string');

		const createdId = res2.body.id;
		expect(createdId).to.be.a('string');

		const storedVideo = await waitForStorageKey(createdId);
		expect(storedVideo).to.be.an('object');

		const storageKey = storedVideo?.storage_key ?? undefined;
		expect(storageKey).to.be.a('string');

		const hotObject = await headObjectInfo(s3, S3_HOT_BUCKET, storageKey);
		expect(hotObject).to.be.an('object');
		expect(hotObject?.contentType).to.equal('video/mp4');
	});

	it('does not start S3 upload until temp file is complete (raw)', async function () {
		const admin = await createTestAdmin(usersRepo);

		const { part1, part2, total } = twoPartReal('mkv');
		const res1 = await uploadChunkRaw({
			filename: 'resume' + extFor('mkv'),
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

		const res2 = await uploadChunkRaw({
			filename: 'resume' + extFor('mkv'),
			file: part2,
			start: part1.length,
			end: total - 1,
			total,
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			sessionId,
		});
		expect(res2.status).to.equal(HttpStatus.OK);
		if (res2.status != 200) throw new Error();
		expect(res2.headers.get('upload-offset')).to.equal(String(total));

		const createdId = res2.body.id;
		expect(createdId).to.be.a('string');

		const storedVideo = await waitForStorageKey(createdId);
		expect(storedVideo).to.be.an('object');

		const storageKey = storedVideo?.storage_key ?? undefined;
		expect(storageKey).to.be.a('string');

		const hotObject = await headObjectInfo(s3, S3_HOT_BUCKET, storageKey);
		expect(hotObject).to.be.an('object');
		expect(hotObject?.contentType).to.equal('video/mp4');
	});
});
