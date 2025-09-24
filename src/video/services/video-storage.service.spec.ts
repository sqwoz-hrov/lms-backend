import { expect } from 'chai';
import * as sinon from 'sinon';
import { VideoStorageService } from './video-storage.service';
import { YoutubeAdapterDouble, S3AdapterDouble } from '../adapters/doubles.adapter';
import { createChunkedStream } from '../../../test/helpers/stream.helper';
import chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';

chai.use(chaiAsPromised);

describe.only('VideoStorageService streaming tee', () => {
	let youtubeDouble: YoutubeAdapterDouble;
	let s3Double: S3AdapterDouble;
	let service: VideoStorageService;

	beforeEach(() => {
		youtubeDouble = new YoutubeAdapterDouble();
		s3Double = new S3AdapterDouble({ slow: true });

		// Собираем сервис с дублями (DI в тесте вручную)
		// В проде это Nest DI, но тут нам достаточно new:
		service = new VideoStorageService(youtubeDouble, s3Double);

		// Зафиксируем UUID, чтобы проверять возвращаемые поля
	});

	afterEach(() => {});

	it('starts teeing immediately and splits data into two identical streams', async () => {
		const { stream: src, totalBytes } = createChunkedStream({
			chunks: 40,
			chunkBytes: 512 * 1024, // 512KB
			delayMs: 3,
		});

		const t0 = Date.now();
		const result = await service.uploadVideo({ file: src, title: 'test' });

		// оба адаптера получили данные
		expect(youtubeDouble.capture.totalBytes).to.equal(totalBytes);
		expect(s3Double.capture.totalBytes).to.equal(totalBytes);

		// первый chunk пришёл до окончания источника (раньше, чем вся загрузка завершилась)
		// и пришёл быстро после вызова uploadVideo (в пределах нескольких десятков миллисекунд)
		expect(youtubeDouble.capture.firstChunkAt).to.be.greaterThanOrEqual(t0);
		expect(s3Double.capture.firstChunkAt).to.be.greaterThanOrEqual(t0);

		// sanity: первые чанки пришли задолго до конца (индекс << числа чанков)
		expect(youtubeDouble.capture.firstChunkIndex).to.be.lessThan(5);
		expect(s3Double.capture.firstChunkIndex).to.be.lessThan(5);

		// параллельность: таймстемпы первых чанков близки
		const delta = Math.abs(youtubeDouble.capture.firstChunkAt! - s3Double.capture.firstChunkAt!);
		expect(delta).to.be.lessThan(15); // мс, допускаем небольшой дрейф планировщика

		// результат сервиса содержит и youtubeLink, и стабовый s3ObjectId
		expect(result.youtubeLink).to.match(/^https:\/\/www\.youtube\.com\/watch\?v=fake-/);
		expect(result.s3ObjectId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
	});

	it('propagates error if one branch fails (YouTube)', async () => {
		// заставим YouTube упасть на чтении
		const fail = new Error('yt down');
		sinon.stub(youtubeDouble, 'uploadVideo').callsFake(async ({ file }: any) => {
			// прочитаем первый чанк и упадём
			await new Promise<void>(resolve => {
				file.once('data', () => resolve());
				file.resume();
			});
			throw fail;
		});

		const { stream: src } = createChunkedStream({ chunks: 10, chunkBytes: 256 * 1024, delayMs: 1 });

		await expect(service.uploadVideo({ file: src, title: 'x' })).to.be.rejectedWith('Video upload failed');
	});

	it('handles slow consumer on one side without starving the other (basic check)', async () => {
		// тут оставляем медленный S3 (slow: true) и быстрый YouTube как есть
		const { stream: src, totalBytes } = createChunkedStream({
			chunks: 30,
			chunkBytes: 256 * 1024,
			delayMs: 2,
		});

		const res = await service.uploadVideo({ file: src, title: 'slow-check' });
		expect(youtubeDouble.capture.totalBytes).to.equal(totalBytes);
		expect(s3Double.capture.totalBytes).to.equal(totalBytes);
		expect(res.s3ObjectId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
	});
});
