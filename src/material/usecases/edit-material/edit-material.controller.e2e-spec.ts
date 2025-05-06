import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRedisContainer } from '@testcontainers/redis';
import { expect } from 'chai';
import { setupTestApplication } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MaterialModule } from '../../material.module';
import { MaterialsTestRepository } from '../../test-utils/test.repo';
import { MaterialsTestSdk } from '../../test-utils/test.sdk';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { UserModule } from '../../../user/user.module';
import { TelegramModule } from '../../../telegram/telegram.module';
import { MarkdownContentModule } from '../../../markdown-content/markdown-content.module';
import { randomWord } from '../../../../test/fixtures/common.fixture';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { createTestMaterial } from '../../../../test/fixtures/material.fixture';
import { UpdateMaterialDto } from '../../dto/update-material.dto';
import { SubjectsTestRepository } from '../../../subject/test-utils/test.repo';

describe('[E2E] Edit material usecase', () => {
	let app: INestApplication;
	let postgresqlContainer: StartedPostgreSqlContainer;
	let redisContainer: StartedRedisContainer;

	let userUtilRepository: UsersTestRepository;
	let materialUtilRepository: MaterialsTestRepository;
	let markdownContentUtilRepository: MarkDownContentTestRepository;
	let subjectUtilRepository: SubjectsTestRepository;
	let materialTestSdk: MaterialsTestSdk;

	before(async () => {
		({ app, postgresqlContainer, redisContainer } = await setupTestApplication({
			imports: [MarkdownContentModule, MaterialModule, UserModule, TelegramModule.forRoot({ useTelegramAPI: false })],
		}));
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		materialUtilRepository = new MaterialsTestRepository(kysely);
		markdownContentUtilRepository = new MarkDownContentTestRepository(kysely);
		subjectUtilRepository = new SubjectsTestRepository(kysely);

		await app.init();
		await app.listen(3000);

		materialTestSdk = new MaterialsTestSdk(
			new TestHttpClient({ port: 3000, host: 'http://127.0.0.1' }),
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);
	});

	afterEach(async () => {
		await userUtilRepository.clearAll();
		await materialUtilRepository.clearAll();
		await markdownContentUtilRepository.clearAll();
		await subjectUtilRepository.clearAll();
	});

	after(async () => {
		await app.close();
		await postgresqlContainer.stop();
		await redisContainer.stop();
	});

	it('Unauthenticated gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const material = await createTestMaterial(
			userUtilRepository,
			markdownContentUtilRepository,
			subjectUtilRepository,
			materialUtilRepository,
		);

		const editDto: UpdateMaterialDto = {
			id: material.id,
			is_archived: false,
		};

		const res = await materialTestSdk.editMaterial({
			params: editDto,
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
		const material = await createTestMaterial(
			userUtilRepository,
			markdownContentUtilRepository,
			subjectUtilRepository,
			materialUtilRepository,
		);

		const editDto: UpdateMaterialDto = {
			id: material.id,
			is_archived: false,
		};

		const res = await materialTestSdk.editMaterial({
			params: editDto,
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
		const material = await createTestMaterial(
			userUtilRepository,
			markdownContentUtilRepository,
			subjectUtilRepository,
			materialUtilRepository,
		);

		const editDto: UpdateMaterialDto = {
			id: material.id,
			is_archived: false,
		};

		const res = await materialTestSdk.editMaterial({
			params: editDto,
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can edit a material', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const material = await createTestMaterial(
			userUtilRepository,
			markdownContentUtilRepository,
			subjectUtilRepository,
			materialUtilRepository,
		);

		const newName = randomWord();

		const editDto: UpdateMaterialDto = {
			id: material.id,
			name: newName,
			is_archived: true,
		};

		const res = await materialTestSdk.editMaterial({
			params: editDto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.name).to.equal(newName);
		expect(res.body.is_archived).to.equal(true);
	});
});
