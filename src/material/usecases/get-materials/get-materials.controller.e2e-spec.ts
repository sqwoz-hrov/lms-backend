import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestMaterial } from '../../../../test/fixtures/material.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
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
		await createTestMaterial(
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
		});

		it('Admin can filter by student_user_id', async () => {
			const res = await materialTestSdk.getMaterials({
				params: { student_user_id: user1.id },
				userMeta: { userId: admin1.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(2);
			for (const m of res.body) {
				expect(m.student_user_id).to.equal(user1.id);
			}
		});

		it('Admin can filter by is_archived', async () => {
			const res = await materialTestSdk.getMaterials({
				params: { is_archived: true },
				userMeta: { userId: admin2.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(1);
			expect(res.body[0].is_archived).to.equal(true);
		});

		it('Admin without filters gets all unarchived materials', async () => {
			const res = await materialTestSdk.getMaterials({
				params: {},
				userMeta: { userId: admin2.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(3);
		});

		it('User only sees their own materials, ignoring student_user_id filters', async () => {
			const res = await materialTestSdk.getMaterials({
				params: { student_user_id: user2.id },
				userMeta: { userId: user1.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(2);
			for (const m of res.body) {
				expect(m.student_user_id).to.equal(user1.id);
			}
		});

		it('User without filters sees only own materials', async () => {
			const res = await materialTestSdk.getMaterials({
				params: {},
				userMeta: { userId: user2.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(1);
			expect(res.body[0].student_user_id).to.equal(user2.id);
		});

		it('User cannot override filters, even when trying to see another student’s or is_archived=true', async () => {
			const res = await materialTestSdk.getMaterials({
				params: { student_user_id: admin1.id, is_archived: true },
				userMeta: { userId: user2.id, isAuth: true, isWrongAccessJwt: false },
			});

			expect(res.status).to.equal(HttpStatus.OK);
			expect(res.body).to.be.an('array').with.length(1);
			expect(res.body[0].student_user_id).to.equal(user2.id);
		});
	});
});
