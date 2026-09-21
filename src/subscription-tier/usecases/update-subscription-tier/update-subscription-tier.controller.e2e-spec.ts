import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { v7 } from 'uuid';
import { createTestAdmin, createTestSubscriptionTier, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { SubscriptionTiersTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Update subscription tier usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let markdownContentRepository: MarkDownContentTestRepository;
	let subscriptionTierTestSdk: SubscriptionTiersTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		markdownContentRepository = new MarkDownContentTestRepository(kysely);

		subscriptionTierTestSdk = new SubscriptionTiersTestSdk(
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
		await markdownContentRepository.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const tier = await createTestSubscriptionTier(userUtilRepository);

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: tier.id,
				tier: 'Updated tier',
			},
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const tier = await createTestSubscriptionTier(userUtilRepository);

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: tier.id,
				tier: 'Updated tier',
			},
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
		const tier = await createTestSubscriptionTier(userUtilRepository);

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: tier.id,
				tier: 'Updated tier',
			},
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can update a subscription tier successfully', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const tier = await createTestSubscriptionTier(userUtilRepository, {
			permissions: ['materials:read'],
			price_rubles: 1000,
			power: 1,
			tier: 'Basic',
		});

		const updatedName = 'Premium';
		const updatedPower = tier.power + 5;
		const updatedPrice = tier.price_rubles + 500;
		const updatedPermissions = ['tasks:read', 'subjects:manage'];

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: tier.id,
				tier: updatedName,
				power: updatedPower,
				price_rubles: updatedPrice,
				permissions: updatedPermissions,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error();
		expect(res.body.id).to.equal(tier.id);
		expect(res.body.tier).to.equal(updatedName);
		expect(res.body.power).to.equal(updatedPower);
		expect(res.body.price_rubles).to.equal(updatedPrice);
		expect(res.body.permissions).to.deep.equal(updatedPermissions);
	});

	it('Admin can update markdown description successfully', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const initialMarkdown = '# Initial subscription tier description';
		const createRes = await subscriptionTierTestSdk.createSubscriptionTier({
			params: {
				tier: 'Tier with editable markdown',
				power: 31,
				price_rubles: 1000,
				permissions: ['materials:read'],
				markdown_description: initialMarkdown,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});
		expect(createRes.status).to.equal(HttpStatus.CREATED);
		if (createRes.status !== HttpStatus.CREATED) throw new Error();

		const tierBeforeUpdate = await userUtilRepository.connection
			.selectFrom('subscription_tier')
			.selectAll()
			.where('id', '=', createRes.body.id)
			.limit(1)
			.executeTakeFirstOrThrow();
		const updatedMarkdown = '# Updated subscription tier description\n\nNow with more details.';

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: createRes.body.id,
				markdown_description: updatedMarkdown,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error();
		expect(res.body.markdown_description).to.equal(updatedMarkdown);

		const tierAfterUpdate = await userUtilRepository.connection
			.selectFrom('subscription_tier')
			.selectAll()
			.where('id', '=', createRes.body.id)
			.limit(1)
			.executeTakeFirstOrThrow();
		expect(tierAfterUpdate.markdown_description_id).to.equal(tierBeforeUpdate.markdown_description_id);

		const markdownInDb = await markdownContentRepository.connection
			.selectFrom('markdown_content')
			.selectAll()
			.where('id', '=', tierAfterUpdate.markdown_description_id)
			.limit(1)
			.executeTakeFirstOrThrow();
		expect(markdownInDb.content_text).to.equal(updatedMarkdown);

		const getRes = await subscriptionTierTestSdk.getSubscriptionTiers({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});
		expect(getRes.status).to.equal(HttpStatus.OK);
		if (getRes.status !== HttpStatus.OK) throw new Error();
		const tierFromGet = getRes.body.find(tier => tier.id === createRes.body.id);
		expect(tierFromGet?.markdown_description).to.equal(updatedMarkdown);
	});

	it('Admin can update tier fields without removing markdown description', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const initialMarkdown = '# Persisted subscription tier description';
		const createRes = await subscriptionTierTestSdk.createSubscriptionTier({
			params: {
				tier: 'Tier with persistent markdown',
				power: 32,
				price_rubles: 1000,
				permissions: ['materials:read'],
				markdown_description: initialMarkdown,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});
		expect(createRes.status).to.equal(HttpStatus.CREATED);
		if (createRes.status !== HttpStatus.CREATED) throw new Error();

		const tierBeforeUpdate = await userUtilRepository.connection
			.selectFrom('subscription_tier')
			.selectAll()
			.where('id', '=', createRes.body.id)
			.limit(1)
			.executeTakeFirstOrThrow();

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: createRes.body.id,
				tier: 'Tier renamed without markdown payload',
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error();
		expect(res.body.markdown_description).to.equal(initialMarkdown);

		const tierAfterUpdate = await userUtilRepository.connection
			.selectFrom('subscription_tier')
			.selectAll()
			.where('id', '=', createRes.body.id)
			.limit(1)
			.executeTakeFirstOrThrow();
		expect(tierAfterUpdate.markdown_description_id).to.equal(tierBeforeUpdate.markdown_description_id);

		const markdownInDb = await markdownContentRepository.connection
			.selectFrom('markdown_content')
			.selectAll()
			.where('id', '=', tierAfterUpdate.markdown_description_id)
			.limit(1)
			.executeTakeFirstOrThrow();
		expect(markdownInDb.content_text).to.equal(initialMarkdown);

		const getRes = await subscriptionTierTestSdk.getSubscriptionTiers({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});
		expect(getRes.status).to.equal(HttpStatus.OK);
		if (getRes.status !== HttpStatus.OK) throw new Error();
		const tierFromGet = getRes.body.find(tier => tier.id === createRes.body.id);
		expect(tierFromGet?.markdown_description).to.equal(initialMarkdown);
	});

	it('Admin can intentionally clear markdown description with null', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const initialMarkdown = '# Markdown to clear';
		const createRes = await subscriptionTierTestSdk.createSubscriptionTier({
			params: {
				tier: 'Tier with removable markdown',
				power: 33,
				price_rubles: 1000,
				permissions: ['materials:read'],
				markdown_description: initialMarkdown,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});
		expect(createRes.status).to.equal(HttpStatus.CREATED);
		if (createRes.status !== HttpStatus.CREATED) throw new Error();

		const tierBeforeUpdate = await userUtilRepository.connection
			.selectFrom('subscription_tier')
			.selectAll()
			.where('id', '=', createRes.body.id)
			.limit(1)
			.executeTakeFirstOrThrow();
		expect(tierBeforeUpdate.markdown_description_id).to.be.a('string');

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: createRes.body.id,
				markdown_description: null,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error();
		expect(res.body.markdown_description).to.equal(undefined);

		const tierAfterUpdate = await userUtilRepository.connection
			.selectFrom('subscription_tier')
			.selectAll()
			.where('id', '=', createRes.body.id)
			.limit(1)
			.executeTakeFirstOrThrow();
		expect(tierAfterUpdate.markdown_description_id).to.equal(null);

		const markdownInDb = await markdownContentRepository.connection
			.selectFrom('markdown_content')
			.selectAll()
			.where('id', '=', tierBeforeUpdate.markdown_description_id)
			.limit(1)
			.executeTakeFirst();
		expect(markdownInDb).to.equal(undefined);

		const getRes = await subscriptionTierTestSdk.getSubscriptionTiers({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});
		expect(getRes.status).to.equal(HttpStatus.OK);
		if (getRes.status !== HttpStatus.OK) throw new Error();
		const tierFromGet = getRes.body.find(tier => tier.id === createRes.body.id);
		expect(tierFromGet?.markdown_description).to.equal(undefined);
	});

	it('Editing non-existing subscription tier returns 404', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await subscriptionTierTestSdk.updateSubscriptionTier({
			params: {
				id: v7(),
				tier: 'Ghost tier',
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.NOT_FOUND);
	});
});
