import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRedisContainer } from '@testcontainers/redis';
import { expect } from 'chai';
import { createTestJournalRecordDto } from '../../../../test/fixtures/journal-record.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { setupTestApplication } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkdownContentModule } from '../../../markdown-content/markdown-content.module';
import { TelegramModule } from '../../../telegram/telegram.module';
import { UsersTestRepository } from '../../../users/test-utils/test.repo';
import { UserModule } from '../../../users/user.module';
import { JournalRecordModule } from '../../journal-record.module';
import { JournalRecordsTestRepository } from '../../test-utils/test.repo';
import { JournalRecordsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Create journal record usecase', () => {
	let app: INestApplication;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;

	let userUtilRepository: UsersTestRepository;
	let journalRecordUtilRepository: JournalRecordsTestRepository;
	let journalTestSdk: JournalRecordsTestSdk;

	before(async () => {
		({ app, postgresqlContainer, redisContainer } = await setupTestApplication({
			imports: [
				JournalRecordModule,
				MarkdownContentModule.forRoot({ useRealImageStorage: false }),
				UserModule,
				TelegramModule.forRoot({ useTelegramAPI: false }),
			],
		}));

		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		journalRecordUtilRepository = new JournalRecordsTestRepository(kysely);

		await app.init();
		await app.listen(3000);

		journalTestSdk = new JournalRecordsTestSdk(
			new TestHttpClient({
				port: 3000,
				host: 'http://127.0.0.1',
			}),
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);
	});

	afterEach(async () => {
		await userUtilRepository.clearAll();
		await journalRecordUtilRepository.clearAll();
	});

	after(async () => {
		await app.close();
		await postgresqlContainer.stop();
		await redisContainer.stop();
	});

	it('Unauthenticated request gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const journalDto = createTestJournalRecordDto(admin.id);

		const res = await journalTestSdk.createJournalRecord({
			params: journalDto,
			userMeta: {
				userId: admin.id,
				isAuth: false,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const journalDto = createTestJournalRecordDto(user.id);

		const res = await journalTestSdk.createJournalRecord({
			params: journalDto,
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const journalDto = createTestJournalRecordDto(admin.id);

		const res = await journalTestSdk.createJournalRecord({
			params: journalDto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can create a journal record successfully', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const journalDto = createTestJournalRecordDto(admin.id);

		const res = await journalTestSdk.createJournalRecord({
			params: journalDto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.student_user_id).to.equal(journalDto.student_user_id);
		expect(res.body.name).to.equal(journalDto.name);
		expect(res.body.markdown_content).to.equal(journalDto.markdown_content);
	});
});
