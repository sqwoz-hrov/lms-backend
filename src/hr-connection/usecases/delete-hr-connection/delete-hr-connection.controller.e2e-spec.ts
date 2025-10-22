import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { v7 } from 'uuid';
import { createTestHrConnection } from '../../../../test/fixtures/hr-connection.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { HrConnectionsTestRepository } from '../../test-utils/test.repo';
import { HrConnectionsTestSdk } from '../../test-utils/test.sdk';
import { ISharedContext } from '../../../../test/setup/test.app-setup';

describe('[E2E] Delete HR connection usecase', () => {
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
		await hrUtilRepository.clearAll();
		await userUtilRepository.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository);

		const res = await hrTestSdk.deleteHrConnection({
			params: { id: hrConnection.id },
			userMeta: {
				userId: user.id,
				isAuth: false,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository);

		const res = await hrTestSdk.deleteHrConnection({
			params: { id: hrConnection.id },
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('User can delete their HR connection', async () => {
		const user = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository, {
			hrConnection: { student_user_id: user.id },
		});

		const res = await hrTestSdk.deleteHrConnection({
			params: { id: hrConnection.id },
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
	});

	it(`User can not delete another user's HR connection`, async () => {
		const owner = await createTestUser(userUtilRepository);
		const anotherUser = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository, {
			hrConnection: { student_user_id: owner.id },
		});

		const res = await hrTestSdk.deleteHrConnection({
			params: { id: hrConnection.id },
			userMeta: {
				userId: anotherUser.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can delete any HR connection', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const student = await createTestUser(userUtilRepository);
		const hrConnection = await createTestHrConnection(userUtilRepository, hrUtilRepository, {
			hrConnection: { student_user_id: student.id },
		});

		const res = await hrTestSdk.deleteHrConnection({
			params: { id: hrConnection.id },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
	});

	it('Non-existent HR connection returns 404', async () => {
		const user = await createTestUser(userUtilRepository);

		const res = await hrTestSdk.deleteHrConnection({
			params: { id: v7() },
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
