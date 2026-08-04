import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestSubject } from '../../../../test/fixtures/subject.fixture';
import {
	createTestActiveGift,
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
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { UserWithNullableSubscriptionTier } from '../../../user/user.entity';
import { Subject } from '../../subject.entity';
import { SubjectsTestRepository } from '../../test-utils/test.repo';
import { SubjectsTestSdk } from '../../test-utils/test.sdk';
import { GiftTestRepository } from '../../../gift/test-utils/test.repo';

describe('[E2E] Get subjects usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let subjectUtilRepository: SubjectsTestRepository;
	let giftUtilRepository: GiftTestRepository;
	let subjectTestSdk: SubjectsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		subjectUtilRepository = new SubjectsTestRepository(kysely);
		giftUtilRepository = new GiftTestRepository(kysely);

		subjectTestSdk = new SubjectsTestSdk(
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
		await giftUtilRepository.clearAll();
		await userUtilRepository.clearAll();
		await subjectUtilRepository.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const res = await subjectTestSdk.getSubjects({
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await subjectTestSdk.getSubjects({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin gets all subjects', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const subject1 = await createTestSubject(subjectUtilRepository);
		const subject2 = await createTestSubject(subjectUtilRepository);

		const res = await subjectTestSdk.getSubjects({
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body.length).to.equal(2);

		const names = res.body.map(s => s.name);
		expect(names).to.include(subject1.name);
		expect(names).to.include(subject2.name);
	});

	it('User also gets all subjects', async () => {
		const user = await createTestUser(userUtilRepository);

		const subject = await createTestSubject(subjectUtilRepository);

		const res = await subjectTestSdk.getSubjects({
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body.length).to.equal(1);
		expect(res.body[0].id).to.equal(subject.id);
		expect(res.body[0].name).to.equal(subject.name);
	});

	describe('Subscriber access tests', () => {
		let admin: UserWithNullableSubscriptionTier;
		let subscriber: TestSubscriber;
		let accessibleSubject: Subject;
		let subjectForAnotherTier: Subject;
		let assignedSubject: Subject;
		let subjectNotMeantForSubscribers: Subject;

		beforeEach(async () => {
			admin = await createTestAdmin(userUtilRepository);
			subscriber = await createTestSubscriber(userUtilRepository);
			const otherTier = await createTestSubscriptionTier(userUtilRepository);

			expect(subscriber.subscription.current_tier_id).to.be.a('string');

			accessibleSubject = await createTestSubject(subjectUtilRepository, {
				name: 'Accessible Subject',
				color_code: '#AA0000',
			});
			subjectForAnotherTier = await createTestSubject(subjectUtilRepository, {
				name: 'Other Tier Subject',
				color_code: '#BB0000',
			});
			assignedSubject = await createTestSubject(subjectUtilRepository, {
				name: 'Assigned Subject',
				color_code: '#CC0000',
			});
			subjectNotMeantForSubscribers = await createTestSubject(subjectUtilRepository, {
				name: 'Not For Subscribers Subject',
				color_code: '#EE0000',
			});

			const allowRes = await subjectTestSdk.openSubjectForTiers({
				subjectId: accessibleSubject.id,
				params: { minimal_tier_id: subscriber.subscription.current_tier_id },
				userMeta: {
					userId: admin.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
			});

			const restrictRes = await subjectTestSdk.openSubjectForTiers({
				subjectId: subjectForAnotherTier.id,
				params: { minimal_tier_id: otherTier.id },
				userMeta: {
					userId: admin.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
			});

			expect(allowRes.status).to.equal(HttpStatus.CREATED);
			expect(restrictRes.status).to.equal(HttpStatus.CREATED);
		});

		it('Subscriber sees only subjects available for their tier', async () => {
			const res = await subjectTestSdk.getSubjects({
				userMeta: {
					userId: subscriber.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			const subjectIds = res.body.map(s => s.id);
			expect(subjectIds).to.have.length(1);
			expect(subjectIds).to.include(accessibleSubject.id);
			expect(subjectIds).to.not.include(subjectForAnotherTier.id);
			expect(subjectIds).to.not.include(assignedSubject.id);
			expect(subjectIds).to.not.include(subjectNotMeantForSubscribers.id);

			const accessibleSubjectResponse = res.body.find(s => s.id === accessibleSubject.id);
			expect(accessibleSubjectResponse?.minimal_tier_id).to.equal(subscriber.subscription.current_tier_id);
		});

		it('Higher paid and gifted tiers see subjects with a lower minimum tier', async () => {
			const minimumTier = await createTestSubscriptionTier(userUtilRepository, {
				tier: 'Minimum Subject Tier',
				power: subscriber.subscription_tier.power + 10,
			});
			const paidTier = await createTestSubscriptionTier(userUtilRepository, {
				tier: 'Higher Paid Subject Tier',
				power: minimumTier.power + 10,
			});
			const giftTier = await createTestSubscriptionTier(userUtilRepository, {
				tier: 'Higher Gift Subject Tier',
				power: paidTier.power + 10,
			});
			const paidSubscriber = await createTestSubscriber(userUtilRepository, { current_tier_id: paidTier.id });
			const paidMinimumTierSub = await createTestSubscriber(userUtilRepository, { current_tier_id: minimumTier.id });
			const subject = await createTestSubject(subjectUtilRepository, {
				name: 'Power-accessible Subject',
				color_code: '#123456',
			});

			await subjectUtilRepository.connection
				.insertInto('subject_tier')
				.values([
					{ subject_id: subject.id, tier_id: giftTier.id },
					{ subject_id: subject.id, tier_id: minimumTier.id },
				])
				.execute();
			await createTestActiveGift(userUtilRepository, {
				giftedTo: subscriber.id,
				tierId: giftTier.id,
				giftedBy: admin.id,
			});

			for (const userId of [paidSubscriber.id, subscriber.id, paidMinimumTierSub.id]) {
				const res = await subjectTestSdk.getSubjects({
					userMeta: { userId, isAuth: true, isWrongAccessJwt: false },
				});

				expect(res.status).to.equal(HttpStatus.OK);
				if (res.status !== HttpStatus.OK) throw new Error();
				const responseSubject = res.body.find(item => item.id === subject.id);
				expect(responseSubject?.minimal_tier_id).to.equal(minimumTier.id);
			}
		});

		it('Subscriber cannot reveal restricted subjects using id filter', async () => {
			const res = await subjectTestSdk.getSubjects({
				userMeta: {
					userId: subscriber.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
				query: { id: subjectNotMeantForSubscribers.id },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			const subjectIds = res.body.map(s => s.id);
			expect(subjectIds).to.have.length(1);
			expect(subjectIds).to.include(accessibleSubject.id);
			expect(subjectIds).to.not.include(subjectForAnotherTier.id);
			expect(subjectIds).to.not.include(assignedSubject.id);
			expect(subjectIds).to.not.include(subjectNotMeantForSubscribers.id);
		});

		it('Subscriber cannot reveal restricted subjects using name filter', async () => {
			const res = await subjectTestSdk.getSubjects({
				userMeta: {
					userId: subscriber.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
				query: { name: assignedSubject.name },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			const subjectIds = res.body.map(s => s.id);
			expect(subjectIds).to.have.length(1);
			expect(subjectIds).to.include(accessibleSubject.id);
			expect(subjectIds).to.not.include(subjectForAnotherTier.id);
			expect(subjectIds).to.not.include(assignedSubject.id);
			expect(subjectIds).to.not.include(subjectNotMeantForSubscribers.id);
		});

		it('Subscriber cannot reveal restricted subjects using color_code filter', async () => {
			const res = await subjectTestSdk.getSubjects({
				userMeta: {
					userId: subscriber.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
				query: { color_code: subjectNotMeantForSubscribers.color_code },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			const subjectIds = res.body.map(s => s.id);
			expect(subjectIds).to.have.length(1);
			expect(subjectIds).to.include(accessibleSubject.id);
			expect(subjectIds).to.not.include(subjectForAnotherTier.id);
			expect(subjectIds).to.not.include(assignedSubject.id);
			expect(subjectIds).to.not.include(subjectNotMeantForSubscribers.id);
		});
	});
});
