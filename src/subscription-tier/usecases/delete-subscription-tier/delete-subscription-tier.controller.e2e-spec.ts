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

describe('[E2E] Delete subscription tier usecase', () => {
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

	it('archives the tier without deleting its markdown description', async () => {
		const admin = await createTestAdmin(usersRepo);
		const markdownDescription = '# Archived tier\n\nStill visible after archive.';
		const createResponse = await subscriptionTierSdk.createSubscriptionTier({
			params: {
				tier: 'Archived markdown tier',
				power: 30,
				price_rubles: 5000,
				permissions: ['archive:test'],
				markdown_description: markdownDescription,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});
		expect(createResponse.status).to.equal(HttpStatus.CREATED);
		if (createResponse.status !== HttpStatus.CREATED) throw new Error('Unexpected response status');

		const tierBeforeDelete = await usersRepo.connection
			.selectFrom('subscription_tier')
			.selectAll()
			.where('id', '=', createResponse.body.id)
			.limit(1)
			.executeTakeFirstOrThrow();

		const deleteResponse = await subscriptionTierSdk.deleteSubscriptionTier({
			params: { id: createResponse.body.id },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(deleteResponse.status).to.equal(HttpStatus.OK);
		if (deleteResponse.status !== HttpStatus.OK) throw new Error('Unexpected response status');

		const tierAfterDelete = await usersRepo.connection
			.selectFrom('subscription_tier')
			.selectAll()
			.where('id', '=', createResponse.body.id)
			.limit(1)
			.executeTakeFirstOrThrow();
		expect(tierAfterDelete.is_archived).to.equal(true);
		expect(tierAfterDelete.markdown_description_id).to.equal(tierBeforeDelete.markdown_description_id);

		const markdownInDb = await markdownContentRepo.connection
			.selectFrom('markdown_content')
			.selectAll()
			.where('id', '=', tierAfterDelete.markdown_description_id)
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
		const archivedTierFromGet = getResponse.body.find(tier => tier.id === createResponse.body.id);
		expect(archivedTierFromGet).to.equal(undefined);
	});
});
