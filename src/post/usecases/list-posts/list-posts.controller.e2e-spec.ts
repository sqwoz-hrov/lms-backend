import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestPost } from '../../../../test/fixtures/post.fixture';
import {
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
import { PostResponseDto } from '../../dto/base-post.dto';
import { SubscriptionTier } from '../../../user/user.entity';
import { createTestVideoRecord } from '../../../../test/fixtures/video-db.fixture';
import { VideosTestRepository } from '../../../video/test-utils/test.repo';

describe('[E2E] List posts usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let postUtilRepository: PostsTestRepository;
	let videoUtilRepository: VideosTestRepository;
	let markdownUtilRepository: MarkDownContentTestRepository;
	let postTestSdk: PostsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		postUtilRepository = new PostsTestRepository(kysely);
		videoUtilRepository = new VideosTestRepository(kysely);
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

	it('Unauthenticated gets 401', async () => {
		const res = await postTestSdk.getPosts({
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin receives list of posts with markdown content', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const firstPost = await createTestPost(postUtilRepository, markdownUtilRepository, {
			post: { title: 'First post' },
			markdown: { content_text: '# First content' },
		});
		const secondPost = await createTestPost(postUtilRepository, markdownUtilRepository, {
			post: { title: 'Second post' },
			markdown: { content_text: '# Second content' },
		});

		const res = await postTestSdk.getPosts({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Request failed');
		}

		const titles = res.body.map(post => post.title);
		expect(titles).to.include(firstPost.post.title);
		expect(titles).to.include(secondPost.post.title);

		const markdowns = res.body.reduce<Record<string, string>>((acc, post) => {
			acc[post.title] = post.markdown_content;
			return acc;
		}, {});
		expect(markdowns[firstPost.post.title]).to.equal(firstPost.markdown.content_text);
		expect(markdowns[secondPost.post.title]).to.equal(secondPost.markdown.content_text);
	});

	it('Supports limit pagination parameter', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		await createTestPost(postUtilRepository, markdownUtilRepository, {
			post: { title: 'Limited Post 1' },
		});
		await createTestPost(postUtilRepository, markdownUtilRepository, {
			post: { title: 'Limited Post 2' },
		});
		await createTestPost(postUtilRepository, markdownUtilRepository, {
			post: { title: 'Limited Post 3' },
		});

		const res = await postTestSdk.getPosts({
			query: { limit: 2 },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Request failed');
		}
		expect(res.body.length).to.equal(2);
	});

	it('Supports cursor pagination with after/before parameters', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const oldest = await createTestPost(postUtilRepository, markdownUtilRepository, {
			post: { title: 'Oldest Post', created_at: new Date('2023-01-01T00:00:00.000Z') },
		});
		const middle = await createTestPost(postUtilRepository, markdownUtilRepository, {
			post: { title: 'Middle Post', created_at: new Date('2023-02-01T00:00:00.000Z') },
		});
		const newest = await createTestPost(postUtilRepository, markdownUtilRepository, {
			post: { title: 'Newest Post', created_at: new Date('2023-03-01T00:00:00.000Z') },
		});

		const initial = await postTestSdk.getPosts({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(initial.status).to.equal(HttpStatus.OK);
		if (initial.status !== HttpStatus.OK) {
			throw new Error('Request failed');
		}

		const orderedTitles = initial.body.map((post: PostResponseDto) => post.title);
		expect(orderedTitles.slice(0, 3)).to.deep.equal([newest.post.title, middle.post.title, oldest.post.title]);

		const afterRes = await postTestSdk.getPosts({
			query: { after: newest.post.created_at.toISOString() },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(afterRes.status).to.equal(HttpStatus.OK);
		if (afterRes.status !== HttpStatus.OK) {
			throw new Error('Request failed');
		}

		const afterTitles = afterRes.body.map((post: PostResponseDto) => post.title);
		expect(afterTitles).to.include(middle.post.title);
		expect(afterTitles).to.include(oldest.post.title);
		expect(afterTitles).to.not.include(newest.post.title);

		const beforeRes = await postTestSdk.getPosts({
			query: { before: middle.post.created_at.toISOString() },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(beforeRes.status).to.equal(HttpStatus.OK);
		if (beforeRes.status !== HttpStatus.OK) {
			throw new Error('Request failed');
		}

		const beforeTitles = beforeRes.body.map((post: PostResponseDto) => post.title);
		expect(beforeTitles).to.include(newest.post.title);
		expect(beforeTitles).to.not.include(middle.post.title);
		expect(beforeTitles).to.not.include(oldest.post.title);
	});

	describe('Subscriber access', () => {
		let subscriber: TestSubscriber;
		let otherTier: SubscriptionTier;

		beforeEach(async () => {
			subscriber = await createTestSubscriber(userUtilRepository);
			otherTier = await createTestSubscriptionTier(userUtilRepository, { tier: 'Other Tier' });

			expect(subscriber.subscription.subscription_tier_id).to.be.a('string');
		});

		it('Subscriber sees all posts with previews for locked entries', async () => {
			const admin = await createTestAdmin(userUtilRepository);
			const accessiblePost = await createTestPost(postUtilRepository, markdownUtilRepository, {
				post: { title: 'Accessible Post' },
			});
			const video = await createTestVideoRecord(videoUtilRepository, admin.id);
			const restrictedPost = await createTestPost(postUtilRepository, markdownUtilRepository, {
				post: { title: 'Restricted Post', video_id: video.id },
			});
			const publicPost = await createTestPost(postUtilRepository, markdownUtilRepository, {
				post: { title: 'Public Post' },
			});

			await postUtilRepository.db
				.insertInto('post_tier')
				.values([
					{
						post_id: accessiblePost.post.id,
						subscription_tier_id: subscriber.subscription.subscription_tier_id,
					},
					{
						post_id: restrictedPost.post.id,
						subscription_tier_id: otherTier.id,
					},
				])
				.execute();

			const res = await postTestSdk.getPosts({
				userMeta: {
					userId: subscriber.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status !== HttpStatus.OK) {
				throw new Error('Request failed');
			}

			const postsByTitle = res.body.reduce<Record<string, PostResponseDto>>((acc, post) => {
				acc[post.title] = post;
				return acc;
			}, {});

			const accessible = postsByTitle[accessiblePost.post.title];
			const publicEntry = postsByTitle[publicPost.post.title];
			const restricted = postsByTitle[restrictedPost.post.title];

			expect(accessible.markdown_content).to.equal(accessiblePost.markdown.content_text);
			expect(accessible.locked_preview).to.be.an('undefined');

			expect(publicEntry.markdown_content).to.equal(publicPost.markdown.content_text);
			expect(publicEntry.locked_preview).to.be.an('undefined');

			const expectedMasked = restrictedPost.markdown.content_text.replace(/[^\r\n]/g, '*');
			expect(restricted.markdown_content).to.equal(expectedMasked);
			expect(restricted.video_id).to.equal(undefined);
			expect(restricted.locked_preview).to.deep.equal({
				masked_text: expectedMasked,
				has_video: true,
			});
		});

		it('Subscriber cannot override tier filter via query params', async () => {
			const accessiblePost = await createTestPost(postUtilRepository, markdownUtilRepository, {
				post: { title: 'Subscriber Post' },
			});
			const restrictedPost = await createTestPost(postUtilRepository, markdownUtilRepository, {
				post: { title: 'Forbidden Post' },
			});

			await postUtilRepository.db
				.insertInto('post_tier')
				.values([
					{
						post_id: accessiblePost.post.id,
						subscription_tier_id: subscriber.subscription.subscription_tier_id,
					},
					{
						post_id: restrictedPost.post.id,
						subscription_tier_id: otherTier.id,
					},
				])
				.execute();

			const res = await postTestSdk.getPosts({
				query: { subscription_tier_id: otherTier.id },
				userMeta: {
					userId: subscriber.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status !== HttpStatus.OK) {
				throw new Error('Request failed');
			}

			expect(res.body.length).to.equal(2);

			const postsByTitle = res.body.reduce<Record<string, PostResponseDto>>((acc, post) => {
				acc[post.title] = post;
				return acc;
			}, {});

			const accessible = postsByTitle[accessiblePost.post.title];
			const restricted = postsByTitle[restrictedPost.post.title];

			expect(accessible.locked_preview).to.be.an('undefined');

			const expectedMasked = restrictedPost.markdown.content_text.replace(/[^\r\n]/g, '*');
			expect(restricted.markdown_content).to.equal(expectedMasked);
			expect(restricted.locked_preview).to.deep.equal({
				masked_text: expectedMasked,
				has_video: false,
			});
		});
	});

	it('Regular user can access posts', async () => {
		const user = await createTestUser(userUtilRepository);

		const createdPost = await createTestPost(postUtilRepository, markdownUtilRepository, {
			post: { title: 'User accessible post' },
		});

		const res = await postTestSdk.getPosts({
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Request failed');
		}

		expect(res.body.length).to.equal(1);
		expect(res.body[0].title).to.equal(createdPost.post.title);
	});
});
