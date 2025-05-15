import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestSubject } from '../../../../test/fixtures/subject.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { BaseSubjectDto } from '../../dto/base-subject.dto';
import { SubjectsTestRepository } from '../../test-utils/test.repo';
import { SubjectsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Get subjects usecase', () => {
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
			new TestHttpClient({
				port: 3000,
				host: 'http://127.0.0.1',
			}),
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);
	});

	afterEach(async () => {
		await userUtilRepository.clearAll();
		await subjectUtilRepository.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const res = await subjectTestSdk.getSubjects({
			userMeta: {
				userId: 'fake',
				isAuth: false,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await subjectTestSdk.getSubjects({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin gets all subjects', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const subject1 = await createTestSubject(subjectUtilRepository);
		const subject2 = await createTestSubject(subjectUtilRepository);

		const res = await subjectTestSdk.getSubjects({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.length).to.equal(2);

		const names = res.body.map((s: BaseSubjectDto) => s.name);
		expect(names).to.include(subject1.name);
		expect(names).to.include(subject2.name);
	});

	it('User also gets all subjects', async () => {
		const user = await createTestUser(userUtilRepository);

		const subject = await createTestSubject(subjectUtilRepository);

		const res = await subjectTestSdk.getSubjects({
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.length).to.equal(1);
		expect(res.body[0].id).to.equal(subject.id);
		expect(res.body[0].name).to.equal(subject.name);
	});
});
