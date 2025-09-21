import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { randomWord } from '../../../../test/fixtures/common.fixture';
import { createTestMaterial } from '../../../../test/fixtures/material.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { SubjectsTestRepository } from '../../../subject/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { UpdateMaterialDto } from '../../dto/update-material.dto';
import { MaterialsTestRepository } from '../../test-utils/test.repo';
import { MaterialsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Edit material usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let materialUtilRepository: MaterialsTestRepository;
	let markdownContentUtilRepository: MarkDownContentTestRepository;
	let subjectUtilRepository: SubjectsTestRepository;
	let materialTestSdk: MaterialsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		materialUtilRepository = new MaterialsTestRepository(kysely);
		markdownContentUtilRepository = new MarkDownContentTestRepository(kysely);
		subjectUtilRepository = new SubjectsTestRepository(kysely);

		materialTestSdk = new MaterialsTestSdk(
			new TestHttpClient(
				{ port: 3000, host: 'http://127.0.0.1' },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await userUtilRepository.clearAll();
		await materialUtilRepository.clearAll();
		await markdownContentUtilRepository.clearAll();
		await subjectUtilRepository.clearAll();
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
				isWrongAccessJwt: false,
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
				isWrongAccessJwt: true,
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
				isWrongAccessJwt: false,
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
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		expect(res.body.name).to.equal(newName);
		expect(res.body.is_archived).to.equal(true);
	});
});
