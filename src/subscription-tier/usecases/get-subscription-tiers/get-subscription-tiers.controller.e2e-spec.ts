import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestAdmin, createTestSubscriptionTier } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { SubscriptionTiersTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Get subscription tiers usecase', () => {
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

	it('bulk resolves markdown descriptions for all returned tiers', async () => {
		const admin = await createTestAdmin(usersRepo);
		const firstMarkdown = '# First tier\n\nBulk markdown one.';
		const secondMarkdown = '# Second tier\n\nBulk markdown two.';

		const [first, second] = await Promise.all([
			subscriptionTierSdk.createSubscriptionTier({
				params: {
					tier: 'Bulk first',
					power: 20,
					price_rubles: 1000,
					permissions: ['first'],
					markdown_description: firstMarkdown,
				},
				userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			}),
			subscriptionTierSdk.createSubscriptionTier({
				params: {
					tier: 'Bulk second',
					power: 21,
					price_rubles: 2000,
					permissions: ['second'],
					markdown_description: secondMarkdown,
				},
				userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			}),
		]);
		expect(first.status).to.equal(HttpStatus.CREATED);
		expect(second.status).to.equal(HttpStatus.CREATED);
		if (first.status !== HttpStatus.CREATED || second.status !== HttpStatus.CREATED) {
			throw new Error('Unexpected response status');
		}

		const response = await subscriptionTierSdk.getSubscriptionTiers({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.OK);
		if (response.status !== HttpStatus.OK) throw new Error('Unexpected response status');
		const firstFromGet = response.body.find(tier => tier.id === first.body.id);
		const secondFromGet = response.body.find(tier => tier.id === second.body.id);
		expect(firstFromGet?.markdown_description).to.equal(firstMarkdown);
		expect(secondFromGet?.markdown_description).to.equal(secondMarkdown);

		const markdownRows = await markdownContentRepo.connection.selectFrom('markdown_content').selectAll().execute();
		expect(markdownRows.map(row => row.content_text)).to.include.members([firstMarkdown, secondMarkdown]);
	});

	it('does not return archived subscription tiers', async () => {
		const admin = await createTestAdmin(usersRepo);
		const activeTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'visible-tier',
			is_archived: false,
		});
		const archivedTier = await createTestSubscriptionTier(usersRepo, {
			tier: 'hidden-archived-tier',
			is_archived: true,
		});

		const response = await subscriptionTierSdk.getSubscriptionTiers({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(response.status).to.equal(HttpStatus.OK);
		if (response.status !== HttpStatus.OK) throw new Error('Unexpected response status');
		expect(response.body.map(tier => tier.id)).to.include(activeTier.id);
		expect(response.body.map(tier => tier.id)).not.to.include(archivedTier.id);
	});
});
