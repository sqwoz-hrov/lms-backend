import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRedisContainer } from '@testcontainers/redis';
import { expect } from 'chai';
import { v7 } from 'uuid';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { createTestSubject } from '../../../../test/fixtures/subject.fixture';
import { setupTestApplication } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { TelegramModule } from '../../../telegram/telegram.module';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { UserModule } from '../../../user/user.module';
import { SubjectModule } from '../../subject.module';
import { SubjectsTestRepository } from '../../test-utils/test.repo';
import { SubjectsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Edit subject usecase', () => {
	let app: INestApplication;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;

	let userUtilRepository: UsersTestRepository;
	let subjectUtilRepository: SubjectsTestRepository;
	let subjectTestSdk: SubjectsTestSdk;

	before(async () => {
		({ app, postgresqlContainer, redisContainer } = await setupTestApplication({
			imports: [SubjectModule, UserModule, TelegramModule.forRoot({ useTelegramAPI: false })],
		}));

		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		subjectUtilRepository = new SubjectsTestRepository(kysely);

		await app.init();
		await app.listen(3000);

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

	after(async () => {
		await app.close();
		await postgresqlContainer.stop();
		await redisContainer.stop();
	});

	it('Unauthenticated request gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const subject = await createTestSubject(subjectUtilRepository);

		const res = await subjectTestSdk.editSubject({
			params: {
				id: subject.id,
				name: 'Updated name',
			},
			userMeta: {
				userId: admin.id,
				isAuth: false,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const subject = await createTestSubject(subjectUtilRepository);

		const res = await subjectTestSdk.editSubject({
			params: {
				id: subject.id,
				name: 'Updated name',
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const subject = await createTestSubject(subjectUtilRepository);

		const res = await subjectTestSdk.editSubject({
			params: {
				id: subject.id,
				name: 'Updated name',
			},
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can update a subject successfully', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const subject = await createTestSubject(subjectUtilRepository);

		const updatedName = 'Algebra';
		const updatedColor = '#00FF00';

		const res = await subjectTestSdk.editSubject({
			params: {
				id: subject.id,
				name: updatedName,
				color_code: updatedColor,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.id).to.equal(subject.id);
		expect(res.body.name).to.equal(updatedName);
		expect(res.body.color_code).to.equal(updatedColor);
	});

	it('Editing non-existing subject returns 404', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await subjectTestSdk.editSubject({
			params: {
				id: v7(),
				name: 'Ghost Subject',
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
