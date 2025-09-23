import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestHrConnectionDto } from '../../../../test/fixtures/hr-connection.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { HrConnectionsTestRepository } from '../../test-utils/test.repo';
import { HrConnectionsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Create HR connection usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let hrUtilRepository: HrConnectionsTestRepository;
	let hrTestSdk: HrConnectionsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		hrUtilRepository = new HrConnectionsTestRepository(kysely);

		hrTestSdk = new HrConnectionsTestSdk(
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
		await hrUtilRepository.clearAll();
	});

	it('Unauthenticated gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const dto = createTestHrConnectionDto(user.id);

		const res = await hrTestSdk.createHrConnection({
			params: dto,
			userMeta: {
				userId: user.id,
				isAuth: false,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const dto = createTestHrConnectionDto(user.id);

		const res = await hrTestSdk.createHrConnection({
			params: dto,
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('User cannot create hr-connection for another student', async () => {
		const user = await createTestUser(userUtilRepository);
		const anotherUser = await createTestUser(userUtilRepository);
		const dto = createTestHrConnectionDto(anotherUser.id);

		const res = await hrTestSdk.createHrConnection({
			params: dto,
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		// Should ignore dto.student_user_id and use the logged-in user id instead
		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.student_user_id).to.equal(user.id);
	});

	it('Admin can create hr-connection for any student', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const student = await createTestUser(userUtilRepository);
		const dto = createTestHrConnectionDto(student.id);

		const res = await hrTestSdk.createHrConnection({
			params: dto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.student_user_id).to.equal(student.id);
		expect(res.body.name).to.equal(dto.name);
	});

	it('User can create hr-connection for themselves', async () => {
		const student = await createTestUser(userUtilRepository);
		const dto = createTestHrConnectionDto(student.id);

		const res = await hrTestSdk.createHrConnection({
			params: dto,
			userMeta: {
				userId: student.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.student_user_id).to.equal(student.id);
	});
});
