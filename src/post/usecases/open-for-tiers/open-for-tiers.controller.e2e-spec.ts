import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestPost } from '../../../../test/fixtures/post.fixture';
import { createTestAdmin, createTestSubscriptionTier, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { PostsTestRepository } from '../../test-utils/test.repo';
import { PostsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Open post for tiers usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let postUtilRepository: PostsTestRepository;
	let markdownUtilRepository: MarkDownContentTestRepository;
	let postTestSdk: PostsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		postUtilRepository = new PostsTestRepository(kysely);
		markdownUtilRepository = new MarkDownContentTestRepository(kysely);

		postTestSdk = new PostsTestSdk(
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
		await postUtilRepository.clearAll();
		await markdownUtilRepository.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const { post } = await createTestPost(postUtilRepository, markdownUtilRepository);
		const tier = await createTestSubscriptionTier(userUtilRepository);

		const res = await postTestSdk.openPostForTiers({
			postId: post.id,
			params: { tier_ids: [tier.id] },
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin request gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const { post } = await createTestPost(postUtilRepository, markdownUtilRepository);
		const tier = await createTestSubscriptionTier(userUtilRepository);

		const res = await postTestSdk.openPostForTiers({
			postId: post.id,
			params: { tier_ids: [tier.id] },
			userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin links post to provided tiers', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const { post } = await createTestPost(postUtilRepository, markdownUtilRepository);
		const tier1 = await createTestSubscriptionTier(userUtilRepository);
		const tier2 = await createTestSubscriptionTier(userUtilRepository);

		const res = await postTestSdk.openPostForTiers({
			postId: post.id,
			params: { tier_ids: [tier1.id, tier2.id] },
			userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status !== HttpStatus.CREATED) {
			throw new Error('Request failed');
		}

		const rows = await postUtilRepository.db.selectFrom('post_tier').selectAll().execute();

		expect(rows).to.have.length(2);
		expect(rows.map(row => row.tier_id)).to.have.members([tier1.id, tier2.id]);
		expect(rows.every(row => row.post_id === post.id)).to.equal(true);
	});
});
