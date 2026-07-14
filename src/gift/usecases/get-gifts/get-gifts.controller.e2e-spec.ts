import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import {
	createTestAdmin,
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
} from '../../../../test/fixtures/user.fixture';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { SubscriptionTestRepository } from '../../../subscription/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { GiftTestRepository } from '../../test-utils/test.repo';
import { GiftTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Get gifts usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let subscriptionRepo: SubscriptionTestRepository;
	let giftRepo: GiftTestRepository;
	let giftSdk: GiftTestSdk;

	const buildUserMeta = (userId: string) => ({
		userId,
		isAuth: true,
		isWrongAccessJwt: false,
	});

	const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

	before(function (this: ISharedContext) {
		app = this.app;
		const dbProvider = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(dbProvider);
		subscriptionRepo = new SubscriptionTestRepository(dbProvider);
		giftRepo = new GiftTestRepository(dbProvider);
		giftSdk = new GiftTestSdk(
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
		await giftRepo.clearAll();
		await subscriptionRepo.clearAll();
		await usersRepo.clearAll();
	});

	it('returns subscriber gifts grouped by availability', async () => {
		const now = new Date();
		const clock = sinon.useFakeTimers({
			now,
			shouldClearNativeTimers: true,
			toFake: ['Date'],
		});

		try {
			const admin = await createTestAdmin(usersRepo);
			const recipient = await createTestSubscriber(usersRepo);
			const anotherRecipient = await createTestSubscriber(usersRepo);
			const tier = await createTestSubscriptionTier(usersRepo, { tier: 'gift-list-tier', power: 5 });

			const availableGift = await giftRepo.insertGift({
				gifted_by: admin.id,
				gifted_to: recipient.id,
				tier_id: tier.id,
				duration_days: 30,
			});
			const activeGift = await giftRepo.insertGift({
				gifted_by: admin.id,
				gifted_to: recipient.id,
				tier_id: tier.id,
				activated_at: now,
				duration_days: 5,
			});
			const usedGift = await giftRepo.insertGift({
				gifted_by: admin.id,
				gifted_to: recipient.id,
				tier_id: tier.id,
				activated_at: addDays(now, -10),
				duration_days: 5,
			});
			await giftRepo.insertGift({
				gifted_by: admin.id,
				gifted_to: anotherRecipient.id,
				tier_id: tier.id,
				duration_days: 30,
			});

			const response = await giftSdk.getGifts({
				userMeta: buildUserMeta(recipient.id),
			});

			expect(response.status).to.equal(HttpStatus.OK);
			if (response.status !== HttpStatus.OK) {
				throw new Error('Unexpected response status');
			}

			expect(response.body.available.map(gift => gift.id)).to.deep.equal([availableGift.id]);
			expect(response.body.currentlyActive.map(gift => gift.id)).to.deep.equal([activeGift.id]);
			expect(response.body.used.map(gift => gift.id)).to.deep.equal([usedGift.id]);
			expect(response.body.available[0].user.email).to.equal(admin.email);
			expect(response.body.available[0].tier.id).to.equal(tier.id);
			expect(response.body.available[0].expiresAt).to.equal(null);
			expect(response.body.currentlyActive[0].expiresAt).to.equal(addDays(now, 5).toISOString());
			expect(response.body.pagination).to.deep.equal({
				page: 1,
				pageSize: 20,
				totalItems: 3,
				totalPages: 1,
				hasNextPage: false,
				hasPreviousPage: false,
			});
		} finally {
			clock.restore();
		}
	});

	it('returns admin sent gifts grouped and searchable by recipient email', async () => {
		const now = new Date();
		const clock = sinon.useFakeTimers({
			now: now,
			shouldClearNativeTimers: true,
			toFake: ['Date'],
		});

		try {
			const admin = await createTestAdmin(usersRepo);
			const otherAdmin = await createTestAdmin(usersRepo);
			const targetRecipient = await createTestSubscriber(usersRepo, { email: 'target.recipient@example.com' });
			const anotherRecipient = await createTestSubscriber(usersRepo, { email: 'another.recipient@example.com' });
			const tier = await createTestSubscriptionTier(usersRepo, { tier: 'admin-gift-list-tier', power: 6 });

			const availableGift = await giftRepo.insertGift({
				gifted_by: admin.id,
				gifted_to: targetRecipient.id,
				tier_id: tier.id,
				duration_days: 15,
			});
			const activeGift = await giftRepo.insertGift({
				gifted_by: admin.id,
				gifted_to: anotherRecipient.id,
				tier_id: tier.id,
				activated_at: now,
				duration_days: 5,
			});
			const usedGift = await giftRepo.insertGift({
				gifted_by: admin.id,
				gifted_to: anotherRecipient.id,
				tier_id: tier.id,
				activated_at: addDays(now, -4),
				duration_days: 3,
			});
			await giftRepo.insertGift({
				gifted_by: otherAdmin.id,
				gifted_to: targetRecipient.id,
				tier_id: tier.id,
				duration_days: 15,
			});

			const groupedResponse = await giftSdk.getGifts({
				userMeta: buildUserMeta(admin.id),
			});

			expect(groupedResponse.status).to.equal(HttpStatus.OK);
			if (groupedResponse.status !== HttpStatus.OK) {
				throw new Error('Unexpected response status');
			}
			expect(groupedResponse.body.available.map(gift => gift.id)).to.deep.equal([availableGift.id]);
			expect(groupedResponse.body.currentlyActive.map(gift => gift.id)).to.deep.equal([activeGift.id]);
			expect(groupedResponse.body.used.map(gift => gift.id)).to.deep.equal([usedGift.id]);
			expect(groupedResponse.body.available[0].user.email).to.equal(targetRecipient.email);

			const searchResponse = await giftSdk.getGifts({
				params: { email: 'target.recipient' },
				userMeta: buildUserMeta(admin.id),
			});

			expect(searchResponse.status).to.equal(HttpStatus.OK);
			if (searchResponse.status !== HttpStatus.OK) {
				throw new Error('Unexpected response status');
			}
			expect(searchResponse.body.available.map(gift => gift.id)).to.deep.equal([availableGift.id]);
			expect(searchResponse.body.currentlyActive).to.deep.equal([]);
			expect(searchResponse.body.used).to.deep.equal([]);
			expect(searchResponse.body.pagination.totalItems).to.equal(1);
		} finally {
			clock.restore();
		}
	});

	it('paginates gifts before returning grouped buckets', async () => {
		const now = new Date();
		const clock = sinon.useFakeTimers({
			now,
			shouldClearNativeTimers: true,
			toFake: ['Date'],
		});

		try {
			const admin = await createTestAdmin(usersRepo);
			const recipient = await createTestSubscriber(usersRepo);
			const tier = await createTestSubscriptionTier(usersRepo, { tier: 'paginated-gift-list-tier', power: 7 });

			await giftRepo.insertGift({
				gifted_by: admin.id,
				gifted_to: recipient.id,
				tier_id: tier.id,
				duration_days: 30,
			});
			await giftRepo.insertGift({
				gifted_by: admin.id,
				gifted_to: recipient.id,
				tier_id: tier.id,
				activated_at: addDays(now, -11),
				duration_days: 10,
			});
			await giftRepo.insertGift({
				gifted_by: admin.id,
				gifted_to: recipient.id,
				tier_id: tier.id,
				activated_at: now,
				duration_days: 5,
			});

			const response = await giftSdk.getGifts({
				params: { pageSize: 2 },
				userMeta: buildUserMeta(recipient.id),
			});

			expect(response.status).to.equal(HttpStatus.OK);
			if (response.status !== HttpStatus.OK) {
				throw new Error('Unexpected response status');
			}
			const returnedCount =
				response.body.available.length + response.body.currentlyActive.length + response.body.used.length;
			expect(returnedCount).to.equal(2);
			expect(response.body.pagination).to.deep.equal({
				page: 1,
				pageSize: 2,
				totalItems: 3,
				totalPages: 2,
				hasNextPage: true,
				hasPreviousPage: false,
			});
		} finally {
			clock.restore();
		}
	});

	it('rejects query params from non-admin', async () => {
		const subscriber = await createTestSubscriber(usersRepo);

		const response = await giftSdk.getGifts({
			params: { pageSize: 1, email: 'sosal' },
			userMeta: buildUserMeta(subscriber.id),
		});

		expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
		if (response.status !== HttpStatus.BAD_REQUEST) {
			throw new Error('Unexpected response status');
		}
	});

	it('rejects regular users', async () => {
		const user = await createTestUser(usersRepo);

		const response = await giftSdk.getGifts({
			userMeta: buildUserMeta(user.id),
		});

		expect(response.status).to.equal(HttpStatus.UNAUTHORIZED);
		if (response.status !== HttpStatus.UNAUTHORIZED) {
			throw new Error('Unexpected response status');
		}
		expect(response.body.description).to.equal('Access denied: role not allowed');
	});
});
