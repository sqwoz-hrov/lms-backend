import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestSubject } from '../../../../test/fixtures/subject.fixture';
import {
	createTestAdmin,
	createTestSubscriber,
	createTestSubscriptionTier,
	createTestUser,
} from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { User } from '../../../user/user.entity';
import { BaseSubjectDto } from '../../dto/base-subject.dto';
import { Subject } from '../../subject.entity';
import { SubjectsTestRepository } from '../../test-utils/test.repo';
import { SubjectsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Get subjects usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let subjectUtilRepository: SubjectsTestRepository;
	let subjectTestSdk: SubjectsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		subjectUtilRepository = new SubjectsTestRepository(kysely);

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
		await userUtilRepository.clearAll();
		await subjectUtilRepository.clearAll();
	});

	it('Unauthenticated request gets 401', async () => {
		const res = await subjectTestSdk.getSubjects({
			userMeta: {
				userId: 'fake',
				isAuth: false,
				isWrongAccessJwt: false,
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
		expect(res.body.length).to.equal(2);

		const names = res.body.map((s: BaseSubjectDto) => s.name);
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
		expect(res.body.length).to.equal(1);
		expect(res.body[0].id).to.equal(subject.id);
		expect(res.body[0].name).to.equal(subject.name);
	});

	describe('Subscriber access tests', () => {
		let admin: User;
		let subscriber: User;
		let accessibleSubject: Subject;
		let restrictedSubject: Subject;
		let hiddenSubject: Subject;

		beforeEach(async () => {
			admin = await createTestAdmin(userUtilRepository);
			subscriber = await createTestSubscriber(userUtilRepository);
			const otherTier = await createTestSubscriptionTier(userUtilRepository);

			expect(subscriber.subscription_tier_id).to.be.a('string');

			accessibleSubject = await createTestSubject(subjectUtilRepository);
			restrictedSubject = await createTestSubject(subjectUtilRepository);
			hiddenSubject = await createTestSubject(subjectUtilRepository);

			const allowRes = await subjectTestSdk.openSubjectForTiers({
				subjectId: accessibleSubject.id,
				params: { tier_ids: [subscriber.subscription_tier_id!] },
				userMeta: {
					userId: admin.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
			});

			const restrictRes = await subjectTestSdk.openSubjectForTiers({
				subjectId: restrictedSubject.id,
				params: { tier_ids: [otherTier.id] },
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
			expect(res.body.length).to.equal(1);
			expect(res.body[0].id).to.equal(accessibleSubject.id);
			expect(res.body.map((s: BaseSubjectDto) => s.id)).to.not.include(restrictedSubject.id);
			expect(res.body.map((s: BaseSubjectDto) => s.id)).to.not.include(hiddenSubject.id);
		});

		it('Subscriber cannot reveal restricted subjects using id filter', async () => {
			const res = await subjectTestSdk.getSubjects({
				userMeta: {
					userId: subscriber.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
				query: { id: restrictedSubject.id },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body.map((s: BaseSubjectDto) => s.id)).to.not.include(restrictedSubject.id);
			expect(res.body.map((s: BaseSubjectDto) => s.id)).to.not.include(hiddenSubject.id);
		});

		it('Subscriber cannot reveal restricted subjects using name filter', async () => {
			const res = await subjectTestSdk.getSubjects({
				userMeta: {
					userId: subscriber.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
				query: { name: restrictedSubject.name },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body.map((s: BaseSubjectDto) => s.id)).to.not.include(restrictedSubject.id);
			expect(res.body.map((s: BaseSubjectDto) => s.id)).to.not.include(hiddenSubject.id);
		});

		it('Subscriber cannot reveal restricted subjects using color_code filter', async () => {
			const res = await subjectTestSdk.getSubjects({
				userMeta: {
					userId: subscriber.id,
					isAuth: true,
					isWrongAccessJwt: false,
				},
				query: { color_code: restrictedSubject.color_code },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body.map((s: BaseSubjectDto) => s.id)).to.not.include(restrictedSubject.id);
			expect(res.body.map((s: BaseSubjectDto) => s.id)).to.not.include(hiddenSubject.id);
		});
	});
});
