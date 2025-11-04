import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestPost } from '../../../../test/fixtures/post.fixture';
import { createTestAdmin, createTestSubscriber, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { PostsTestRepository } from '../../test-utils/test.repo';
import { PostsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Delete post usecase', () => {
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

	it('Unauthenticated gets 401', async () => {
		const res = await postTestSdk.deletePost({
			params: {
				id: 'post-id',
			},
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const { post } = await createTestPost(postUtilRepository, markdownUtilRepository);

		const res = await postTestSdk.deletePost({
			params: {
				id: post.id,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Regular user gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const { post } = await createTestPost(postUtilRepository, markdownUtilRepository);

		const res = await postTestSdk.deletePost({
			params: {
				id: post.id,
			},
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Subscriber gets 401', async () => {
		const subscriber = await createTestSubscriber(userUtilRepository);
		const { post } = await createTestPost(postUtilRepository, markdownUtilRepository);

		const res = await postTestSdk.deletePost({
			params: {
				id: post.id,
			},
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Returns 404 when post does not exist', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await postTestSdk.deletePost({
			params: {
				id: 'f16aa32c-951f-4933-9da0-807ea66f7b1f',
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});

	it('Admin can delete post', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const { post, markdown } = await createTestPost(postUtilRepository, markdownUtilRepository);

		const res = await postTestSdk.deletePost({
			params: {
				id: post.id,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error('Failed to delete post');
		expect(res.body.id).to.equal(post.id);
		expect(res.body.markdown_content_id).to.equal(markdown.id);
		expect(res.body.markdown_content).to.equal(markdown.content_text);
	});
});
