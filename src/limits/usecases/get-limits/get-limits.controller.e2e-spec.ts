import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import {
	createTestAdmin,
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
} from '../../../../test/fixtures/user.fixture';
import { createLimitsFixture } from '../../../../test/fixtures/limits.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { aiUsageLimitsConfig, jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { LimitsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Get limits usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let httpClient: TestHttpClient;
	let limitsSdk: LimitsTestSdk;
	let limitsFixture: ReturnType<typeof createLimitsFixture>;
	let limitsConfig: ConfigType<typeof aiUsageLimitsConfig>;

	before(function (this: ISharedContext) {
		app = this.app;
		const db = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(db);
		limitsFixture = createLimitsFixture(db);
		limitsConfig = app.get<ConfigType<typeof aiUsageLimitsConfig>>(aiUsageLimitsConfig.KEY);
		httpClient = new TestHttpClient(
			{
				host: 'http://127.0.0.1',
				port: 3000,
			},
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);
		limitsSdk = new LimitsTestSdk(httpClient);
	});

	afterEach(async () => {
		await usersRepo.clearAll();
	});

	it('rejects unauthenticated calls', async () => {
		const res = await limitsSdk.getLimits({
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('returns zero limits for admin regardless of usage records', async () => {
		const admin = await createTestAdmin(usersRepo);
		await limitsFixture.insertUsageRecords({ userId: admin.id, count: 5 });

		const res = await limitsSdk.getLimits({
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: admin.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Expected 200 response');
		}

		expect(res.body.applied).to.deep.equal([]);
		expect(res.body.exceeded).to.deep.equal([]);
	});

	it('returns zero limits for non-sub user regardless of usage records', async () => {
		const user = await createTestUser(usersRepo);
		await limitsFixture.insertUsageRecords({ userId: user.id, count: 5 });

		const res = await limitsSdk.getLimits({
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: user.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Expected 200 response');
		}

		expect(res.body.applied).to.deep.equal([]);
		expect(res.body.exceeded).to.deep.equal([]);
	});
    
    it('returns zero limits for admin regardless of usage records', async () => {
		const admin = await createTestAdmin(usersRepo);
		await limitsFixture.insertUsageRecords({ userId: admin.id, count: 5 });

		const res = await limitsSdk.getLimits({
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: admin.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Expected 200 response');
		}

		expect(res.body.applied).to.deep.equal([]);
		expect(res.body.exceeded).to.deep.equal([]);
	});

	it('returns zero limits for non-free subscriber regardless of usage records', async () => {
		const paidTier = await createTestSubscriptionTier(usersRepo, {
			power: 1,
			price_rubles: 1000,
			tier: 'paid',
		});
		const subscriber = await createTestSubscriber(usersRepo, {
			subscription_tier_id: paidTier.id,
			is_billable: true,
		});
		await limitsFixture.insertUsageRecords({ userId: subscriber.id, count: 5 });

		const res = await limitsSdk.getLimits({
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: subscriber.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Expected 200 response');
		}

		expect(res.body.applied).to.deep.equal([]);
		expect(res.body.exceeded).to.deep.equal([]);
	});

	it('returns applied and exceeded limits for free-tier subscriber based on user_ai_usage records', async () => {
		const freeTier = await createTestSubscriptionTier(usersRepo, {
			power: 0,
			price_rubles: 0,
			tier: 'free',
		});
		const subscriber = await createTestSubscriber(usersRepo, {
			subscription_tier_id: freeTier.id,
			is_billable: false,
		});
		const threshold = Math.max(limitsConfig.interviewTranscriptionDaily, limitsConfig.interviewTranscriptionHourly);
		await limitsFixture.insertUsageRecords({ userId: subscriber.id, count: threshold });

		const res = await limitsSdk.getLimits({
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId: subscriber.id,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Expected 200 response');
		}

		expect(res.body.applied.map(limit => limit.name)).to.have.members([
			`interview_transcription_daily_${limitsConfig.interviewTranscriptionDaily}`,
			`interview_transcription_hourly_${limitsConfig.interviewTranscriptionHourly}`,
		]);
		expect(res.body.exceeded.map(limit => limit.name)).to.have.members([
			`interview_transcription_daily_${limitsConfig.interviewTranscriptionDaily}`,
			`interview_transcription_hourly_${limitsConfig.interviewTranscriptionHourly}`,
		]);
	});
});
