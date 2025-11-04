import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestPostDto } from '../../../../test/fixtures/post.fixture';
import { createTestAdmin, createTestSubscriber, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { PostsTestRepository } from '../../test-utils/test.repo';
import { PostsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Create post usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let postUtilRepository: PostsTestRepository;
	let postTestSdk: PostsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		postUtilRepository = new PostsTestRepository(kysely);

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
	});

	it('Unauthenticated gets 401', async () => {
		const dto = createTestPostDto();

		const res = await postTestSdk.createPost({
			params: dto,
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake jwt gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const dto = createTestPostDto();

		const res = await postTestSdk.createPost({
			params: dto,
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
		const dto = createTestPostDto();

		const res = await postTestSdk.createPost({
			params: dto,
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
		const dto = createTestPostDto();

		const res = await postTestSdk.createPost({
			params: dto,
			userMeta: {
				userId: subscriber.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can create post', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const dto = createTestPostDto();

		const res = await postTestSdk.createPost({
			params: dto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.CREATED);
		if (res.status !== HttpStatus.CREATED) throw new Error('Failed to create post');
		expect(res.body.title).to.equal(dto.title);
		expect(res.body.markdown_content).to.equal(dto.markdown_content);
		expect(res.body.video_id).to.equal(undefined);
		expect(res.body.markdown_content_id).to.be.a('string');
	});
});
