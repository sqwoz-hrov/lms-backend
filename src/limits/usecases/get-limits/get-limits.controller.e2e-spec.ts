import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Kysely } from 'kysely';
import { expect } from 'chai';
import {
	createTestAdmin,
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
} from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { aiUsageLimitsConfig, jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UserAiUsageTable } from '../../ai-usage.entity';
import { LimitsResponseDto } from '../../dto/limits-response.dto';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';

describe('[E2E] Get limits usecase', () => {
	let app: INestApplication;
	let usersRepo: UsersTestRepository;
	let limitsConnection: Kysely<{ user_ai_usage: UserAiUsageTable }>;
	let httpClient: TestHttpClient;
	let limitsConfig: ConfigType<typeof aiUsageLimitsConfig>;

	before(function (this: ISharedContext) {
		app = this.app;
		const db = app.get(DatabaseProvider);
		usersRepo = new UsersTestRepository(db);
		limitsConnection = db.getDatabase<{ user_ai_usage: UserAiUsageTable }>();
		limitsConfig = app.get<ConfigType<typeof aiUsageLimitsConfig>>(aiUsageLimitsConfig.KEY);
		httpClient = new TestHttpClient(
			{
				host: 'http://127.0.0.1',
				port: 3000,
			},
			app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
		);
	});

	afterEach(async () => {
		await usersRepo.clearAll();
	});

	const getLimits = async ({ userId }: { userId: string }) => {
		return await httpClient.request<LimitsResponseDto>({
			path: '/limits',
			method: 'GET',
			userMeta: {
				isAuth: true,
				isWrongAccessJwt: false,
				userId,
			},
		});
	};

	const insertUsageRecords = async ({ userId, count }: { userId: string; count: number }) => {
		for (let i = 0; i < count; i++) {
			await limitsConnection
				.insertInto('user_ai_usage')
				.values({
					user_id: userId,
					feature: 'interview_transcription',
				})
				.execute();
		}
	};

	it('rejects unauthenticated calls', async () => {
		const res = await httpClient.request<LimitsResponseDto>({
			path: '/limits',
			method: 'GET',
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('returns zero limits for admin regardless of usage records', async () => {
		const admin = await createTestAdmin(usersRepo);
		await insertUsageRecords({ userId: admin.id, count: 5 });

		const res = await getLimits({ userId: admin.id });

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Expected 200 response');
		}

		expect(res.body.applied).to.deep.equal([]);
		expect(res.body.exceeded).to.deep.equal([]);
	});

	it('returns zero limits for non-sub user regardless of usage records', async () => {
		const user = await createTestUser(usersRepo);
		await insertUsageRecords({ userId: user.id, count: 5 });

		const res = await getLimits({ userId: user.id });

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) {
			throw new Error('Expected 200 response');
		}

		expect(res.body.applied).to.deep.equal([]);
		expect(res.body.exceeded).to.deep.equal([]);
	});
    
    it('returns zero limits for admin regardless of usage records', async () => {
		const admin = await createTestAdmin(usersRepo);
		await insertUsageRecords({ userId: admin.id, count: 5 });

		const res = await getLimits({ userId: admin.id });

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
		await insertUsageRecords({ userId: subscriber.id, count: 5 });

		const res = await getLimits({ userId: subscriber.id });

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
		await insertUsageRecords({ userId: subscriber.id, count: threshold });

		const res = await getLimits({ userId: subscriber.id });

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
