import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { randomBytes } from 'crypto';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig, s3Config } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { VideosTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Upload Video — resumable via MinIO', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let videoTestSdk: VideosTestSdk;
	let jwtConf: ConfigType<typeof jwtConfig>;

	let s3: S3Client;
	let S3_HOT_BUCKET: string;
	let S3_COLD_BUCKET: string;

	async function bucketIsEmpty(s3: S3Client, bucket: string): Promise<boolean> {
		const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
		return !res.Contents || res.Contents.length === 0;
	}

	async function headObjectSize(s3: S3Client, bucket: string, key?: string): Promise<number | undefined> {
		if (!key) return undefined;
		const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
		return head.ContentLength ?? undefined;
	}

	async function findObjectOfSize(bucket: string, size: number): Promise<number | undefined> {
		const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
		if (!res.Contents || res.Contents.length === 0) return undefined;
		for (const o of res.Contents) {
			const sizeFromHead = await headObjectSize(s3, bucket, o.Key);
			if (sizeFromHead === size) return sizeFromHead;
		}
		return undefined;
	}

	async function clearBucket(s3: S3Client, bucket: string): Promise<void> {
		try {
			let continuationToken: string | undefined;

			do {
				const listParams = {
					Bucket: bucket,
					...(continuationToken && { ContinuationToken: continuationToken }),
				};

				const listResponse = await s3.send(new ListObjectsV2Command(listParams));

				if (!listResponse.Contents || listResponse.Contents.length === 0) {
					break;
				}

				for (const object of listResponse.Contents) {
					if (object.Key) {
						try {
							await s3.send(
								new DeleteObjectCommand({
									Bucket: bucket,
									Key: object.Key,
								}),
							);
						} catch (deleteError) {
							console.warn(`Failed to delete object ${object.Key}:`, deleteError);
						}
					}
				}

				continuationToken = listResponse.NextContinuationToken;
			} while (continuationToken);
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === 'NoSuchBucket') {
					console.log(`Bucket ${bucket} does not exist, skipping clear operation`);
					return;
				}

				console.error(`Error clearing bucket ${bucket}:`, error.message);
				throw error;
			}
			throw error;
		}
	}

	before(function (this: ISharedContext) {
		app = this.app;

		const kysely = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(kysely);

		jwtConf = app.get(jwtConfig.KEY);
		videoTestSdk = new VideosTestSdk(new TestHttpClient({ port: 3000, host: 'http://127.0.0.1' }, jwtConf));

		// Инициализация S3 клиента из конфига
		const s3Conf = app.get<ConfigType<typeof s3Config>>(s3Config.KEY);
		S3_HOT_BUCKET = s3Conf.videosHotBucketName;
		S3_COLD_BUCKET = s3Conf.videosColdBucketName;

		s3 = new S3Client({
			region: s3Conf.region,
			endpoint: s3Conf.endpoint,
			forcePathStyle: s3Conf.forcePathStyle,
			credentials: {
				accessKeyId: s3Conf.accessKeyId,
				secretAccessKey: s3Conf.secretAccessKey,
			},
		});
	});

	afterEach(async () => {
		await usersRepo.clearAll();
		await clearBucket(s3, S3_HOT_BUCKET);
		await clearBucket(s3, S3_COLD_BUCKET);
	});

	it('rejects unauthorized user (401)', async () => {
		const user = await createTestUser(usersRepo);
		const buf = randomBytes(1024 * 1024);
		const start = 0;
		const end = buf.length - 1;
		const total = buf.length;

		const res = await videoTestSdk.uploadChunk({
			params: {
				file: buf,
				filename: 'unauth.bin',
				start,
				end,
				totalSize: total,
			},
			userMeta: { userId: user.id, isAuth: false, isWrongAccessJwt: false },
			headers: {
				'content-range': `bytes ${start}-${end}/${total}`,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('happy path: uploads file fully to both buckets', async function () {
		const admin = await createTestAdmin(usersRepo);

		const size = 8 * 1024 * 1024;
		const buf = Buffer.from(randomBytes(size));

		expect(await bucketIsEmpty(s3, S3_HOT_BUCKET)).to.equal(true);
		expect(await bucketIsEmpty(s3, S3_COLD_BUCKET)).to.equal(true);

		const res = await videoTestSdk.uploadWhole({
			params: { file: buf, filename: 'happy.bin' },
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.CREATED);

		expect(res.headers.get('upload-length')).to.equal(String(size));
		expect(res.headers.get('upload-offset')).to.equal(String(size));
		expect(res.headers.get('location')).to.be.a('string');

		const hotKeySize = await findObjectOfSize(S3_HOT_BUCKET, size);
		const coldKeySize = await findObjectOfSize(S3_COLD_BUCKET, size);
		expect(hotKeySize).to.equal(size);
		expect(coldKeySize).to.equal(size);
	});

	it('resumes upload after client interruption (2 chunks)', async function () {
		const admin = await createTestAdmin(usersRepo);

		const size = 10 * 1024 * 1024; // 10 MB
		const buf = randomBytes(size);
		const mid = Math.floor(size / 2);

		const res1 = await videoTestSdk.uploadChunk({
			params: {
				file: buf,
				filename: 'resume.bin',
				start: 0,
				end: mid - 1,
				totalSize: size,
			},
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			headers: {
				'content-range': `bytes 0-${mid - 1}/${size}`,
			},
		});

		expect(res1.status).to.equal(HttpStatus.NO_CONTENT);
		expect(res1.headers.get('upload-offset')).to.equal(String(mid));
		const sessionId = res1.headers.get('upload-session-id') as string;
		expect(sessionId).to.be.a('string');

		expect(await bucketIsEmpty(s3, S3_HOT_BUCKET)).to.equal(true);
		expect(await bucketIsEmpty(s3, S3_COLD_BUCKET)).to.equal(true);

		const res2 = await videoTestSdk.uploadChunk({
			params: {
				file: buf,
				filename: 'resume.bin',
				start: mid,
				end: size - 1,
				totalSize: size,
			},
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			headers: {
				'content-range': `bytes ${mid}-${size - 1}/${size}`,
				'upload-session-id': sessionId,
			},
		});

		expect(res2.status).to.equal(HttpStatus.CREATED);
		expect(res2.headers.get('upload-offset')).to.equal(String(size));
		expect(res2.headers.get('upload-length')).to.equal(String(size));
		expect(res2.headers.get('location')).to.be.a('string');

		const hotKeySize = await findObjectOfSize(S3_HOT_BUCKET, size);
		const coldKeySize = await findObjectOfSize(S3_COLD_BUCKET, size);
		expect(hotKeySize).to.equal(size);
		expect(coldKeySize).to.equal(size);
	});

	it('does not start S3 upload until temp file is complete', async function () {
		const admin = await createTestAdmin(usersRepo);

		const size = 6 * 1024 * 1024;
		const buf = randomBytes(size);

		const end = Math.floor(size / 3) - 1;
		const res1 = await videoTestSdk.uploadChunk({
			params: {
				file: buf,
				filename: 'not-yet.bin',
				start: 0,
				end,
				totalSize: size,
			},
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			headers: {
				'content-range': `bytes 0-${end}/${size}`,
			},
		});
		expect(res1.status).to.equal(HttpStatus.NO_CONTENT);
		expect(res1.headers.get('upload-offset')).to.equal(String(end + 1));
		const sessionId = res1.headers.get('upload-session-id') as string;

		expect(await bucketIsEmpty(s3, S3_HOT_BUCKET)).to.equal(true);
		expect(await bucketIsEmpty(s3, S3_COLD_BUCKET)).to.equal(true);

		const res2 = await videoTestSdk.uploadChunk({
			params: {
				file: buf,
				filename: 'not-yet.bin',
				start: end + 1,
				end: size - 1,
				totalSize: size,
			},
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			headers: {
				'content-range': `bytes ${end + 1}-${size - 1}/${size}`,
				'upload-session-id': sessionId,
			},
		});
		expect(res2.status).to.equal(HttpStatus.CREATED);
		expect(res2.headers.get('upload-offset')).to.equal(String(size));

		const hotKeySize = await findObjectOfSize(S3_HOT_BUCKET, size);
		const coldKeySize = await findObjectOfSize(S3_COLD_BUCKET, size);
		expect(hotKeySize).to.equal(size);
		expect(coldKeySize).to.equal(size);
	});

	it.skip('does not create two identical objects for the same file (dedup)', async () => {
		// TODO: включить, когда появится дедупликация
	});
});
