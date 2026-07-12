import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestAdmin } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { SubscriptionTiersTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Create subscription tier usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let markdownContentRepo: MarkDownContentTestRepository;
	let subscriptionTierSdk: SubscriptionTiersTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(dbProvider);
		markdownContentRepo = new MarkDownContentTestRepository(dbProvider);
		subscriptionTierSdk = new SubscriptionTiersTestSdk(
			new TestHttpClient(
				{ port: 3000, host: 'http://127.0.0.1' },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await usersRepo.clearAll();
		await markdownContentRepo.clearAll();
	});

	it('stores markdown description and returns it through get subscription tiers', async () => {
		const admin = await createTestAdmin(usersRepo);
		const markdownDescription = '# Premium\n\nValid **markdown** description.';

		const response = await subscriptionTierSdk.createSubscriptionTier({
			params: {
				tier: 'Premium markdown tier',
				power: 10,
				price_rubles: 3000,
				permissions: ['materials:read', 'tasks:read'],
				markdown_description: markdownDescription,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.CREATED);
		if (response.status !== HttpStatus.CREATED) throw new Error('Unexpected response status');
		expect(response.body.markdown_description).to.equal(markdownDescription);

		const tierInDb = await usersRepo.connection
			.selectFrom('subscription_tier')
			.selectAll()
			.where('id', '=', response.body.id)
			.limit(1)
			.executeTakeFirstOrThrow();
		expect(tierInDb.markdown_description_id).to.be.a('string');

		const markdownInDb = await markdownContentRepo.connection
			.selectFrom('markdown_content')
			.selectAll()
			.where('id', '=', tierInDb.markdown_description_id)
			.limit(1)
			.executeTakeFirstOrThrow();
		expect(markdownInDb.content_text).to.equal(markdownDescription);

		const getResponse = await subscriptionTierSdk.getSubscriptionTiers({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});
		expect(getResponse.status).to.equal(HttpStatus.OK);
		if (getResponse.status !== HttpStatus.OK) throw new Error('Unexpected response status');
		const tierFromGet = getResponse.body.find(tier => tier.id === response.body.id);
		expect(tierFromGet?.markdown_description).to.equal(markdownDescription);
	});
});
