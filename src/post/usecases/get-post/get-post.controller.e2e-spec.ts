import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import { createTestPost } from '../../../../test/fixtures/post.fixture';
import {
	createTestActiveGift,
	createTestAdmin,
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
	type TestSubscriber,
} from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { PostsTestRepository } from '../../test-utils/test.repo';
import { PostsTestSdk } from '../../test-utils/test.sdk';
import { createTestVideoRecord } from '../../../../test/fixtures/video-db.fixture';
import { VideosTestRepository } from '../../../video/test-utils/test.repo';
import { GiftTestRepository } from '../../../gift/test-utils/test.repo';

describe('[E2E] Get post by id usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let postUtilRepository: PostsTestRepository;
	let markdownUtilRepository: MarkDownContentTestRepository;
	let videoUtilRepository: VideosTestRepository;
	let giftUtilRepository: GiftTestRepository;
	let postTestSdk: PostsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		postUtilRepository = new PostsTestRepository(kysely);
		markdownUtilRepository = new MarkDownContentTestRepository(kysely);
		videoUtilRepository = new VideosTestRepository(kysely);
		giftUtilRepository = new GiftTestRepository(kysely);

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
		await giftUtilRepository.clearAll();
		await userUtilRepository.clearAll();
		await postUtilRepository.clearAll();
		await markdownUtilRepository.clearAll();
		await videoUtilRepository.clearAll();
	});

	it('Unauthenticated gets 401', async () => {
		const created = await createTestPost(postUtilRepository, markdownUtilRepository);

		const res = await postTestSdk.getPostById({
			params: { id: created.post.id },
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const created = await createTestPost(postUtilRepository, markdownUtilRepository);

		const res = await postTestSdk.getPostById({
			params: { id: created.post.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: true,
				userId: created.post.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Returns 404 when post does not exist', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await postTestSdk.getPostById({
			params: { id: randomUUID() },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: admin.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});

	it('Admin receives post with markdown content', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const created = await createTestPost(postUtilRepository, markdownUtilRepository, {
			post: { title: 'Get Post Admin' },
			markdown: { content_text: '# Post for admin' },
		});

		const res = await postTestSdk.getPostById({
			params: { id: created.post.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: admin.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Request failed');
		}

		expect(res.body.id).to.equal(created.post.id);
		expect(res.body.title).to.equal(created.post.title);
		expect(res.body.markdown_content).to.equal(created.markdown.content_text);
	});

	it('Authenticated users can get a slug-enabled post by UUID or slug', async () => {
		const user = await createTestUser(userUtilRepository);
		const created = await createTestPost(postUtilRepository, markdownUtilRepository, {
			post: { title: 'Пост со ссылкой', slug: 'post-so-ssylkoy' },
		});

		for (const identifier of [created.post.id, created.post.slug!]) {
			const res = await postTestSdk.getPostById({
				params: { id: identifier },
				userMeta: { userId: user.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status !== HttpStatus.OK) throw new Error('Request failed');
			expect(res.body.id).to.equal(created.post.id);
			expect(res.body.slug).to.equal(created.post.slug);
		}
	});

	describe('Subscriber access', () => {
		let subscriber: TestSubscriber;
		let otherTierId: string;

		beforeEach(async () => {
			subscriber = await createTestSubscriber(userUtilRepository);
			const otherTier = await createTestSubscriptionTier(userUtilRepository);
			otherTierId = otherTier.id;
		});

		it('Subscriber receives full post when allowed', async () => {
			const created = await createTestPost(postUtilRepository, markdownUtilRepository);

			await postUtilRepository.db
				.insertInto('post_tier')
				.values({
					post_id: created.post.id,
					tier_id: subscriber.subscription.current_tier_id,
				})
				.execute();

			const res = await postTestSdk.getPostById({
				params: { id: created.post.id },
				userMeta: {
					isAuth: true,
					isWrongAccessJwt: false,
					userId: subscriber.id,
				},
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status !== HttpStatus.OK) {
				throw new Error('Request failed');
			}

			expect(res.body.markdown_content).to.equal(created.markdown.content_text);
			expect(res.body.locked_preview).to.equal(undefined);
			expect(res.body.video_id).to.equal(created.post.video_id ?? undefined);
		});

		it('Higher or equal paid and gifted tiers receive a post with a lower minimum tier', async () => {
			const minimumTier = await createTestSubscriptionTier(userUtilRepository, {
				tier: 'Minimum Post Tier',
				power: subscriber.subscription_tier.power + 10,
			});
			const paidTier = await createTestSubscriptionTier(userUtilRepository, {
				tier: 'Higher Paid Post Tier',
				power: minimumTier.power + 10,
			});
			const giftTier = await createTestSubscriptionTier(userUtilRepository, {
				tier: 'Higher Gift Post Tier',
				power: paidTier.power + 10,
			});
			const paidSubscriber = await createTestSubscriber(userUtilRepository, { current_tier_id: paidTier.id });
			const minimumTierPaidSub = await createTestSubscriber(userUtilRepository, { current_tier_id: minimumTier.id });
			const created = await createTestPost(postUtilRepository, markdownUtilRepository);

			await postUtilRepository.db
				.insertInto('post_tier')
				.values([
					{ post_id: created.post.id, tier_id: giftTier.id },
					{ post_id: created.post.id, tier_id: minimumTier.id },
				])
				.execute();
			await createTestActiveGift(userUtilRepository, {
				giftedTo: subscriber.id,
				tierId: giftTier.id,
			});

			for (const userId of [paidSubscriber.id, subscriber.id, minimumTierPaidSub.id]) {
				const res = await postTestSdk.getPostById({
					params: { id: created.post.id },
					userMeta: { userId, isAuth: true, isWrongAccessJwt: false },
				});

				expect(res.status).to.equal(HttpStatus.OK);
				if (res.status !== HttpStatus.OK) throw new Error('Request failed');
				expect(res.body.markdown_content).to.equal(created.markdown.content_text);
				expect(res.body.locked_preview).to.equal(undefined);
				expect(res.body.minimal_tier_id).to.equal(minimumTier.id);
			}
		});

		it('Subscriber receives locked preview when not allowed', async () => {
			const admin = await createTestAdmin(userUtilRepository);
			const video = await createTestVideoRecord(videoUtilRepository, admin.id);
			const created = await createTestPost(postUtilRepository, markdownUtilRepository, {
				post: { video_id: video.id, title: 'Restricted Post' },
			});

			await postUtilRepository.db
				.insertInto('post_tier')
				.values({
					post_id: created.post.id,
					tier_id: otherTierId,
				})
				.execute();

			const res = await postTestSdk.getPostById({
				params: { id: created.post.id },
				userMeta: {
					isAuth: true,
					isWrongAccessJwt: false,
					userId: subscriber.id,
				},
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status !== HttpStatus.OK) {
				throw new Error('Request failed');
			}

			expect(res.body.markdown_content).to.equal(undefined);
			expect(res.body.video_id).to.equal(undefined);
			expect(res.body.locked_preview).to.deep.equal({
				has_video: true,
			});
		});
	});

	it('Regular user can access post', async () => {
		const user = await createTestUser(userUtilRepository);
		const created = await createTestPost(postUtilRepository, markdownUtilRepository);

		const res = await postTestSdk.getPostById({
			params: { id: created.post.id },
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: user.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Request failed');
		}

		expect(res.body.markdown_content).to.equal(created.markdown.content_text);
		expect(res.body.locked_preview).to.equal(undefined);
	});
});
