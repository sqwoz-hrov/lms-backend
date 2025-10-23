import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestMaterial } from '../../../../test/fixtures/material.fixture';
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
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { SubjectsTestRepository } from '../../../subject/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { User } from '../../../user/user.entity';
import { MaterialsTestRepository } from '../../test-utils/test.repo';
import { MaterialsTestSdk } from '../../test-utils/test.sdk';
import { Material } from '../../material.entity';

describe('[E2E] Get materials usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let materialUtilRepository: MaterialsTestRepository;
	let markdownContentUtilRepository: MarkDownContentTestRepository;
	let subjectUtilRepository: SubjectsTestRepository;
	let materialTestSdk: MaterialsTestSdk;

	const createMaterial = async ({
		student_user_id,
		is_archived,
	}: {
		student_user_id?: string;
		is_archived?: boolean;
	}) => {
		return await createTestMaterial(
			userUtilRepository,
			markdownContentUtilRepository,
			subjectUtilRepository,
			materialUtilRepository,
			{
				material: {
					student_user_id,
					is_archived,
				},
			},
		);
	};

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(kysely);
		materialUtilRepository = new MaterialsTestRepository(kysely);
		markdownContentUtilRepository = new MarkDownContentTestRepository(kysely);
		subjectUtilRepository = new SubjectsTestRepository(kysely);

		materialTestSdk = new MaterialsTestSdk(
			new TestHttpClient(
				{ port: 3000, host: 'http://127.0.0.1' },
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await userUtilRepository.clearAll();
		await materialUtilRepository.clearAll();
		await markdownContentUtilRepository.clearAll();
		await subjectUtilRepository.clearAll();
	});

	it('Unauthenticated gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await materialTestSdk.getMaterials({
			params: { student_user_id: admin.id },
			userMeta: {
				userId: admin.id,
				isAuth: false,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);

		const res = await materialTestSdk.getMaterials({
			params: { student_user_id: admin.id },
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	describe('Query filters tests', () => {
		let admin1: User;
		let admin2: User;
		let user1: User;
		let user2: User;

		beforeEach(async () => {
			admin1 = await createTestAdmin(userUtilRepository);
			admin2 = await createTestAdmin(userUtilRepository);
			user1 = await createTestUser(userUtilRepository);
			user2 = await createTestUser(userUtilRepository);

			await createMaterial({ student_user_id: user1.id });
			await createMaterial({ student_user_id: user1.id });
			await createMaterial({ student_user_id: user2.id });
			await createMaterial({ is_archived: true });
			await createMaterial({ is_archived: false });
		});

		it('Admin can filter by student_user_id', async () => {
			const res = await materialTestSdk.getMaterials({
				params: { student_user_id: user1.id },
				userMeta: { userId: admin1.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(3);
			for (const m of res.body) {
				expect([null, user1.id]).to.include(m.student_user_id);
			}
		});

		it('Admin can filter by is_archived', async () => {
			const res = await materialTestSdk.getMaterials({
				params: { is_archived: true },
				userMeta: { userId: admin2.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(1);
			expect(res.body[0].is_archived).to.equal(true);
		});

		it('Admin without filters gets all unarchived materials', async () => {
			const res = await materialTestSdk.getMaterials({
				params: {},
				userMeta: { userId: admin2.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(4);
		});

		it('User only sees their own materials, ignoring student_user_id filters', async () => {
			const res = await materialTestSdk.getMaterials({
				params: { student_user_id: user2.id },
				userMeta: { userId: user1.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(3);
			for (const m of res.body) {
				expect([null, user1.id]).to.include(m.student_user_id);
			}
		});

		it('User without filters sees only own materials', async () => {
			const res = await materialTestSdk.getMaterials({
				params: {},
				userMeta: { userId: user2.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(2);
			expect(res.body[0].student_user_id).to.equal(user2.id);
		});

		it('User cannot override filters, even when trying to see another student’s or is_archived=true', async () => {
			const res = await materialTestSdk.getMaterials({
				params: { student_user_id: admin1.id, is_archived: true },
				userMeta: { userId: user2.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(2);
			expect(res.body[0].student_user_id).to.equal(user2.id);
		});
	});

	describe('Subscriber access tests', () => {
		let admin: User;
		let student: User;
		let subscriber: User;
		let accessibleMaterial: Material;
		let materialForAnotherTier: Material;
		let assignedMaterial: Material;
		let hiddenMaterial: Material;
		let materialNotMeantForSubscribers: Material;

		beforeEach(async () => {
			admin = await createTestAdmin(userUtilRepository);
			student = await createTestUser(userUtilRepository);
			subscriber = await createTestSubscriber(userUtilRepository);

			const otherTier = await createTestSubscriptionTier(userUtilRepository);

			expect(subscriber.subscription_tier_id).to.be.a('string');

			accessibleMaterial = await createMaterial({});
			materialForAnotherTier = await createMaterial({});
			assignedMaterial = await createMaterial({ student_user_id: student.id });
			hiddenMaterial = await createMaterial({ is_archived: true });
			materialNotMeantForSubscribers = await createMaterial({});

			const allowRes = await materialTestSdk.openMaterialForTiers({
				materialId: accessibleMaterial.id,
				params: { tier_ids: [subscriber.subscription_tier_id!] },
				userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			});

			const restrictRes = await materialTestSdk.openMaterialForTiers({
				materialId: materialForAnotherTier.id,
				params: { tier_ids: [otherTier.id] },
				userMeta: { userId: admin.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(allowRes.status).to.equal(HttpStatus.CREATED);
			expect(restrictRes.status).to.equal(HttpStatus.CREATED);
		});

		it('Subscriber only sees materials available for their tier', async () => {
			const res = await materialTestSdk.getMaterials({
				params: {},
				userMeta: { userId: subscriber.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			const materialIds = res.body.map(material => material.id);
			expect(materialIds).to.have.length(1);
			expect(materialIds).to.include(accessibleMaterial.id);
			expect(materialIds).to.not.include(materialNotMeantForSubscribers.id);
			expect(materialIds).to.not.include(materialForAnotherTier.id);
			expect(materialIds).to.not.include(hiddenMaterial.id);
		});

		it('Subscriber cannot reveal restricted materials using subject_id filter', async () => {
			const res = await materialTestSdk.getMaterials({
				params: { subject_id: materialForAnotherTier.subject_id },
				userMeta: { userId: subscriber.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			expect(res.body).to.be.an('array').with.length(0);
		});

		it('Subscriber cannot reveal restricted materials using student_user_id filter', async () => {
			expect(assignedMaterial.student_user_id).to.be.a('string');

			const res = await materialTestSdk.getMaterials({
				params: { student_user_id: assignedMaterial.student_user_id! },
				userMeta: { userId: subscriber.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			const materialIds = res.body.map(material => material.id);
			expect(materialIds).to.have.length(1); // ignores student_user_id filter and returns available materials
			expect(materialIds).to.include(accessibleMaterial.id);
			expect(materialIds).to.not.include(materialNotMeantForSubscribers.id);
			expect(materialIds).to.not.include(materialForAnotherTier.id);
			expect(materialIds).to.not.include(hiddenMaterial.id);
		});

		it('Subscriber cannot reveal restricted materials using is_archived filter', async () => {
			const res = await materialTestSdk.getMaterials({
				params: { is_archived: true },
				userMeta: { userId: subscriber.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			if (res.status != 200) throw new Error();
			const materialIds = res.body.map(material => material.id);
			expect(materialIds).to.have.length(1); // ignores is_archived filter and returns available materials
			expect(materialIds).to.include(accessibleMaterial.id);
			expect(materialIds).to.not.include(materialNotMeantForSubscribers.id);
			expect(materialIds).to.not.include(materialForAnotherTier.id);
			expect(materialIds).to.not.include(hiddenMaterial.id);
		});
	});
});
