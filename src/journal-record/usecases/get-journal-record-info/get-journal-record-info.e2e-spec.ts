import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { v7 } from 'uuid';
import { createTestJournalRecord } from '../../../../test/fixtures/journal-record.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { JournalRecordsTestRepository } from '../../test-utils/test.repo';
import { JournalRecordsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Get journal record info usecase', () => {
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
		const admin = await createTestAdmin(userUtilRepository);
		const journal = await createTestJournalRecord(
			userUtilRepository,
			markdownContentRepository,
			journalRecordUtilRepository,
		);

		const res = await journalTestSdk.getJournalRecordInfo({
			params: { id: journal.id },
			userMeta: {
				userId: admin.id,
				isAuth: false,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const journal = await createTestJournalRecord(
			userUtilRepository,
			markdownContentRepository,
			journalRecordUtilRepository,
		);

		const res = await journalTestSdk.getJournalRecordInfo({
			params: { id: journal.id },
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
		const journal = await createTestJournalRecord(
			userUtilRepository,
			markdownContentRepository,
			journalRecordUtilRepository,
		);

		const res = await journalTestSdk.getJournalRecordInfo({
			params: { id: journal.id },
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can successfully retrieve a journal record', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const journal = await createTestJournalRecord(
			userUtilRepository,
			markdownContentRepository,
			journalRecordUtilRepository,
		);

		const res = await journalTestSdk.getJournalRecordInfo({
			params: { id: journal.id },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.id).to.equal(journal.id);
		expect(res.body.name).to.equal(journal.name);
	});

	it('Returns 404 when journal record does not exist', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await journalTestSdk.getJournalRecordInfo({
			params: { id: v7() },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
