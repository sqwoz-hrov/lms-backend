import { HttpStatus, INestApplication } from '@nestjs/common';
import { expect } from 'chai';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../../../config';
import { TestHttpClient } from '../../../../test/test.http-client';
import { VideosTestSdk } from '../../test-utils/test.sdk';
import { createTestAdmin } from '../../../../test/fixtures/user.fixture';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { S3AdapterDouble, YoutubeAdapterDouble } from '../../adapters/doubles.adapter';
import { S3_VIDEO_STORAGE_ADAPTER, YOUTUBE_VIDEO_STORAGE_ADAPTER } from '../../constants';
import { ISharedContext } from '../../../../test/test.app-setup';
import { randomBytes } from 'crypto';
import { FormidableTimingProbe } from '../../../common/testing/formidable-timing-probe';

describe.only('[E2E] Upload Video — stream split & parallel', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let sdk: VideosTestSdk;

	let yt: YoutubeAdapterDouble;
	let s3: S3AdapterDouble;
	let probe: FormidableTimingProbe;

	before(function (this: ISharedContext) {
		app = this.app;

		const kysely = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(kysely);

		yt = app.get<YoutubeAdapterDouble>(YOUTUBE_VIDEO_STORAGE_ADAPTER);
		s3 = app.get<S3AdapterDouble>(S3_VIDEO_STORAGE_ADAPTER);
		probe = app.get(FormidableTimingProbe);

		sdk = new VideosTestSdk(
			new TestHttpClient(
				{ port: 3000, host: 'http://127.0.0.1' },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await usersRepo.clearAll();
		yt.capture = { totalBytes: 0 };
		s3.capture = { totalBytes: 0 };
		probe.reset();
	});

	it('streams are split and processed during formidable parsing (≈parallel on server)', async () => {
		const admin = await createTestAdmin(usersRepo);

		const size = 200 * 1024 * 1024; // 200 MB
		const buf = randomBytes(size);

		const res = await sdk.uploadVideo({
			params: { file: buf, filename: 'big-test.bin' },
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.CREATED);

		// оба потребителя получили файл полностью
		expect(yt.capture.totalBytes).to.equal(size);
		expect(s3.capture.totalBytes).to.equal(size);

		// серверные метки
		expect(probe.mark.requestStartAt, 'probe.requestStartAt missing').to.be.a('number');
		expect(probe.mark.startAt, 'probe.startAt missing').to.be.a('number');
		expect(probe.mark.endAt, 'probe.endAt missing').to.be.a('number');
		expect(probe.mark.startAt!).to.be.at.least(probe.mark.requestStartAt!);
		expect(probe.mark.endAt!).to.be.greaterThan(probe.mark.startAt!);

		// у обоих адаптеров есть метки первого/последнего чанка
		expect(yt.capture.firstChunkAt, 'yt firstChunkAt missing').to.be.a('number');
		expect(s3.capture.firstChunkAt, 's3 firstChunkAt missing').to.be.a('number');
		expect(yt.capture.lastChunkAt, 'yt lastChunkAt missing').to.be.a('number');
		expect(s3.capture.lastChunkAt, 's3 lastChunkAt missing').to.be.a('number');

		// порядок событий: requestStart <= parseStart <= first <= last <= parseEnd
		expect(yt.capture.firstChunkAt!).to.be.at.least(probe.mark.startAt!);
		expect(s3.capture.firstChunkAt!).to.be.at.least(probe.mark.startAt!);
		expect(yt.capture.lastChunkAt!).to.be.at.most(probe.mark.endAt!);
		expect(s3.capture.lastChunkAt!).to.be.at.most(probe.mark.endAt!);

		// Δ(reqStart → firstChunk) <= 100ms
		const dReqStartYT = yt.capture.firstChunkAt! - probe.mark.requestStartAt!;
		const dReqStartS3 = s3.capture.firstChunkAt! - probe.mark.requestStartAt!;
		expect(dReqStartYT).to.be.at.least(0);
		expect(dReqStartS3).to.be.at.least(0);
		expect(dReqStartYT, `Δ(reqStart→YT first)=${dReqStartYT}ms`).to.be.lessThan(50);
		expect(dReqStartS3, `Δ(reqStart→S3 first)=${dReqStartS3}ms`).to.be.lessThan(50);

		// Δ(parseStart → firstChunk) <= 50ms
		const dStartYT = yt.capture.firstChunkAt! - probe.mark.startAt!;
		const dStartS3 = s3.capture.firstChunkAt! - probe.mark.startAt!;
		expect(dStartYT).to.be.at.least(0);
		expect(dStartS3).to.be.at.least(0);
		expect(dStartYT, `Δ(start→YT first)=${dStartYT}ms`).to.be.lessThan(50);
		expect(dStartS3, `Δ(start→S3 first)=${dStartS3}ms`).to.be.lessThan(50);

		// почти одновременный старт веток
		const dBetweenStarts = Math.abs(yt.capture.firstChunkAt! - s3.capture.firstChunkAt!);
		expect(dBetweenStarts, `Δ(YT first↔S3 first)=${dBetweenStarts}ms`).to.be.lessThan(50);

		// Δ(lastChunk → parseEnd) <= 50ms
		const dEndYT = probe.mark.endAt! - yt.capture.lastChunkAt!;
		const dEndS3 = probe.mark.endAt! - s3.capture.lastChunkAt!;
		expect(dEndYT).to.be.at.least(0);
		expect(dEndS3).to.be.at.least(0);
		expect(dEndYT, `Δ(YT last→end)=${dEndYT}ms`).to.be.lessThan(50);
		expect(dEndS3, `Δ(S3 last→end)=${dEndS3}ms`).to.be.lessThan(50);

		expect(probe.mark.elapsedMs!).to.be.greaterThan(0);
	});
});
