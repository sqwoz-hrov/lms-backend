import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRedisContainer } from '@testcontainers/redis';
import { setupTestApplication } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MaterialModule } from '../../material.module';
import { MaterialsTestRepository } from '../../test-utils/test.repo';
import { MaterialsTestSdk } from '../../test-utils/test.sdk';
import { expect } from 'chai';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { UserModule } from '../../../user/user.module';
import { MarkdownContentModule } from '../../../markdown-content/markdown-content.module';
import { createTestMaterialDto } from '../../../../test/fixtures/material.fixture';
import { TelegramModule } from '../../../telegram/telegram.module';
import { createTestSubject } from '../../../../test/fixtures/subject.fixture';
import { SubjectsTestRepository } from '../../../subject/test-utils/test.repo';

describe('[E2E] Create material usecase', () => {
	let app: INestApplication;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;

	let userUtilRepository: UsersTestRepository;
	let materialUtilRepository: MaterialsTestRepository;
	let subjectUtilRepository: SubjectsTestRepository;
	let materialTestSdk: MaterialsTestSdk;

	before(async () => {
		({ app, postgresqlContainer, redisContainer } = await setupTestApplication({
			imports: [MarkdownContentModule, MaterialModule, UserModule, TelegramModule.forRoot({ useTelegramAPI: false })],
		}));
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		materialUtilRepository = new MaterialsTestRepository(kysely);
		subjectUtilRepository = new SubjectsTestRepository(kysely);

		await app.init();
		await app.listen(3000);

		materialTestSdk = new MaterialsTestSdk(
			new TestHttpClient({
				port: 3000,
				host: 'http://127.0.0.1',
			}),
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);
	});

	afterEach(async () => {
		await userUtilRepository.clearAll();
		await materialUtilRepository.clearAll();
		await subjectUtilRepository.clearAll();
	});

	after(async () => {
		await app.close();
		await postgresqlContainer.stop();
		await redisContainer.stop();
	});

	it('Unauthenticated gets 401', async () => {
		const author = await createTestAdmin(userUtilRepository);
		const material = createTestMaterialDto('subject-id');

		const res = await materialTestSdk.createMaterial({
			params: material,
			userMeta: {
				userId: author.id,
				isAuth: false,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const author = await createTestAdmin(userUtilRepository);
		const material = createTestMaterialDto('subject-id');

		const res = await materialTestSdk.createMaterial({
			params: material,
			userMeta: {
				userId: author.id,
				isAuth: true,
				isWrongJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const material = createTestMaterialDto('subject-id');

		const res = await materialTestSdk.createMaterial({
			params: material,
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can create material', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const subject = await createTestSubject(subjectUtilRepository);
		const dto = createTestMaterialDto(subject.id);

		const res = await materialTestSdk.createMaterial({
			params: dto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		expect(res.body.name).to.equal(dto.name);
		expect(res.body.subject_id).to.equal(dto.subject_id);
		expect(res.body.type).to.equal(dto.type);
		expect(res.body.markdown_content).to.equal(dto.markdown_content);
	});
});
