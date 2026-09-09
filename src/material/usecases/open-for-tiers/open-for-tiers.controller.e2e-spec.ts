import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestMaterial } from '../../../../test/fixtures/material.fixture';
import { createTestAdmin, createTestSubscriptionTier, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { SubjectsTestRepository } from '../../../subject/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { MaterialsTestRepository } from '../../test-utils/test.repo';
import { MaterialsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Open material for tiers usecase', () => {
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

	const prepareMaterial = async () =>
		createTestMaterial(
			userUtilRepository,
			markdownContentUtilRepository,
			subjectUtilRepository,
			materialUtilRepository,
		);

	it('Unauthenticated request gets 401', async () => {
		const material = await prepareMaterial();
		const tier = await createTestSubscriptionTier(userUtilRepository);

		const res = await materialTestSdk.openMaterialForTiers({
			materialId: material.id,
			params: { minimal_tier_id: tier.id },
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin request gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const material = await prepareMaterial();
		const tier = await createTestSubscriptionTier(userUtilRepository);

		const res = await materialTestSdk.openMaterialForTiers({
			materialId: material.id,
			params: { minimal_tier_id: tier.id },
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin replaces existing tiers with one minimum tier', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const material = await prepareMaterial();
		const oldTier = await createTestSubscriptionTier(userUtilRepository);
		const minimumTier = await createTestSubscriptionTier(userUtilRepository);

		await materialUtilRepository.connection
			.insertInto('material_tier')
			.values({ material_id: material.id, tier_id: oldTier.id })
			.execute();

		const res = await materialTestSdk.openMaterialForTiers({
			materialId: material.id,
			params: { minimal_tier_id: minimumTier.id },
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status != 201) throw new Error();

		const rows = await materialUtilRepository.connection.selectFrom('material_tier').selectAll().execute();

		expect(rows).to.deep.equal([{ material_id: material.id, tier_id: minimumTier.id }]);
	});
});
