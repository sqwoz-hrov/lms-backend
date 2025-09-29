import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestJournalRecordDto } from '../../../../test/fixtures/journal-record.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { JournalRecordsTestRepository } from '../../test-utils/test.repo';
import { JournalRecordsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Create journal record usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let journalRecordUtilRepository: JournalRecordsTestRepository;
	let journalTestSdk: JournalRecordsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
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
		await journalRecordUtilRepository.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const journalDto = createTestJournalRecordDto(admin.id);

		const res = await journalTestSdk.createJournalRecord({
			params: journalDto,
			userMeta: {
				userId: admin.id,
				isAuth: false,
				isWrongAccessJwt: false,
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
				isWrongAccessJwt: false,
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
				isWrongAccessJwt: true,
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
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.student_user_id).to.equal(journalDto.student_user_id);
		expect(res.body.name).to.equal(journalDto.name);
		expect(res.body.markdown_content).to.equal(journalDto.markdown_content);
	});
});
