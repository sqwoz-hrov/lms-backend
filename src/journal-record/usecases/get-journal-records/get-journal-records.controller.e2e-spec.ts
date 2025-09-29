import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestJournalRecord } from '../../../../test/fixtures/journal-record.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { BaseJournalRecordDto } from '../../dto/base-journal-record.dto';
import { JournalRecordsTestRepository } from '../../test-utils/test.repo';
import { JournalRecordsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Get journal records usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let markdownContentRepository: MarkDownContentTestRepository;
	let journalRecordUtilRepository: JournalRecordsTestRepository;
	let journalTestSdk: JournalRecordsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		markdownContentRepository = new MarkDownContentTestRepository(kysely);
		journalRecordUtilRepository = new JournalRecordsTestRepository(kysely);

		journalTestSdk = new JournalRecordsTestSdk(
			new TestHttpClient(
				{
					port: 3000,
					host: 'http://127.0.0.1',
				},
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await userUtilRepository.clearAll();
		await markdownContentRepository.clearAll();
		await journalRecordUtilRepository.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const res = await journalTestSdk.getJournalRecords({
			params: {},
			userMeta: {
				userId: 'fake',
				isAuth: false,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await journalTestSdk.getJournalRecords({
			params: {},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const user = await createTestUser(userUtilRepository);

		const res = await journalTestSdk.getJournalRecords({
			params: {},
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin gets all journal records', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const record1 = await createTestJournalRecord(
			userUtilRepository,
			markdownContentRepository,
			journalRecordUtilRepository,
		);
		const record2 = await createTestJournalRecord(
			userUtilRepository,
			markdownContentRepository,
			journalRecordUtilRepository,
		);

		const res = await journalTestSdk.getJournalRecords({
			params: {},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.length).to.equal(2);

		const names = res.body.map((r: BaseJournalRecordDto) => r.name);
		expect(names).to.include(record1.name);
		expect(names).to.include(record2.name);
	});
});
