import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestSubject } from '../../../../test/fixtures/subject.fixture';
import { createTestAdmin, createTestSubscriptionTier, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { SubjectsTestRepository } from '../../test-utils/test.repo';
import { SubjectsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Open subject for tiers usecase', () => {
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
				{ port: 3000, host: 'http://127.0.0.1' },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await userUtilRepository.clearAll();
		await subjectUtilRepository.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const subject = await createTestSubject(subjectUtilRepository);
		const tier = await createTestSubscriptionTier(userUtilRepository);

		const res = await subjectTestSdk.openSubjectForTiers({
			subjectId: subject.id,
			params: { minimal_tier_id: tier.id },
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin request gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const subject = await createTestSubject(subjectUtilRepository);
		const tier = await createTestSubscriptionTier(userUtilRepository);

		const res = await subjectTestSdk.openSubjectForTiers({
			subjectId: subject.id,
			params: { minimal_tier_id: tier.id },
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin replaces existing tiers with one minimum tier', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const subject = await createTestSubject(subjectUtilRepository);
		const oldTier = await createTestSubscriptionTier(userUtilRepository);
		const minimumTier = await createTestSubscriptionTier(userUtilRepository);

		await subjectUtilRepository.connection
			.insertInto('subject_tier')
			.values({ subject_id: subject.id, tier_id: oldTier.id })
			.execute();

		const res = await subjectTestSdk.openSubjectForTiers({
			subjectId: subject.id,
			params: { minimal_tier_id: minimumTier.id },
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status != 201) throw new Error();

		const rows = await subjectUtilRepository.connection.selectFrom('subject_tier').selectAll().execute();

		expect(rows).to.deep.equal([{ subject_id: subject.id, tier_id: minimumTier.id }]);
	});
});
