import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestSubjectDto } from '../../../../test/fixtures/subject.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { SubjectsTestRepository } from '../../test-utils/test.repo';
import { SubjectsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Create subject usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let subjectUtilRepository: SubjectsTestRepository;
	let subjectTestSdk: SubjectsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		subjectUtilRepository = new SubjectsTestRepository(kysely);

		subjectTestSdk = new SubjectsTestSdk(
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
		await subjectUtilRepository.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const subjectDto = createTestSubjectDto();

		const res = await subjectTestSdk.createSubject({
			params: subjectDto,
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
		const subjectDto = createTestSubjectDto();

		const res = await subjectTestSdk.createSubject({
			params: subjectDto,
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
		const subjectDto = createTestSubjectDto();

		const res = await subjectTestSdk.createSubject({
			params: subjectDto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can create a subject successfully', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const subjectDto = createTestSubjectDto();

		const res = await subjectTestSdk.createSubject({
			params: subjectDto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.name).to.equal(subjectDto.name);
		expect(res.body.color_code).to.equal(subjectDto.color_code);
		expect(res.body.id).to.be.a('string');
	});
});
