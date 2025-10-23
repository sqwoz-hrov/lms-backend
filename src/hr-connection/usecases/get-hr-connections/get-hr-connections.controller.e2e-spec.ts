import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestHrConnection } from '../../../../test/fixtures/hr-connection.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { User } from '../../../user/user.entity';
import { HrConnectionsTestRepository } from '../../test-utils/test.repo';
import { HrConnectionsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Get HR connections usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let hrConnectionUtilRepository: HrConnectionsTestRepository;
	let sdk: HrConnectionsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		hrConnectionUtilRepository = new HrConnectionsTestRepository(kysely);

		sdk = new HrConnectionsTestSdk(
			new TestHttpClient(
				{ port: 3000, host: 'http://127.0.0.1' },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await userUtilRepository.clearAll();
		await hrConnectionUtilRepository.clearAll();
	});

	it('Unauthenticated gets 401', async () => {
		const res = await sdk.getHrConnections({
			params: {},
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const res = await sdk.getHrConnections({
			params: {},
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: true },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	describe('Query filters and access control', () => {
		let admin1: User;
		let admin2: User;

		let user1: User;
		let user2: User;
		let user3: User;

		beforeEach(async () => {
			admin1 = await createTestAdmin(userUtilRepository);
			admin2 = await createTestAdmin(userUtilRepository);

			user1 = await createTestUser(userUtilRepository);
			user2 = await createTestUser(userUtilRepository);
			user3 = await createTestUser(userUtilRepository);

			// HR connections
			await createTestHrConnection(userUtilRepository, hrConnectionUtilRepository, {
				hrConnection: { student_user_id: user1.id },
			});
			await createTestHrConnection(userUtilRepository, hrConnectionUtilRepository, {
				hrConnection: { student_user_id: user2.id },
			});
			await createTestHrConnection(userUtilRepository, hrConnectionUtilRepository, {
				hrConnection: { student_user_id: user2.id },
			});
			await createTestHrConnection(userUtilRepository, hrConnectionUtilRepository, {
				hrConnection: { student_user_id: user3.id },
			});
		});

		it('Admin can filter by student_user_id', async () => {
			const res = await sdk.getHrConnections({
				params: { student_user_id: user2.id },
				userMeta: { userId: admin1.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(2);
			for (const conn of res.body) {
				expect(conn.student_user_id).to.equal(user2.id);
			}
		});

		it('Admin without filters gets all connections', async () => {
			const res = await sdk.getHrConnections({
				params: {},
				userMeta: { userId: admin2.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(4);
		});

		it('Regular user only sees their own connections, ignoring filters', async () => {
			const res = await sdk.getHrConnections({
				params: { student_user_id: user1.id },
				userMeta: { userId: user2.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(2);
			for (const conn of res.body) {
				expect(conn.student_user_id).to.equal(user2.id);
			}
		});

		it('Regular user without filters sees only own connections', async () => {
			const res = await sdk.getHrConnections({
				params: {},
				userMeta: { userId: user3.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(1);
			expect(res.body[0].student_user_id).to.equal(user3.id);
		});
	});
});
