import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { randomWord } from '../../../../test/fixtures/common.fixture';
import { createTestMarkdownContent } from '../../../../test/fixtures/markdown-content.fixture';
import { createTestMaterial } from '../../../../test/fixtures/material.fixture';
import { createTestSubject } from '../../../../test/fixtures/subject.fixture';
import { createTestVideoRecord } from '../../../../test/fixtures/video-db.fixture';
import { createTestAdmin, createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { MarkDownContentTestRepository } from '../../../markdown-content/test-utils/test.repo';
import { SubjectsTestRepository } from '../../../subject/test-utils/test.repo';
import { UsersTestRepository } from '../../../user/test-utils/test.repo';
import { VideosTestRepository } from '../../../video/test-utils/test.repo';
import { UpdateMaterialDto } from '../../dto/update-material.dto';
import { MaterialsTestRepository } from '../../test-utils/test.repo';
import { MaterialsTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Edit material usecase', () => {
	let app: INestApplication;

	let userUtilRepository: UsersTestRepository;
	let materialUtilRepository: MaterialsTestRepository;
	let markdownContentUtilRepository: MarkDownContentTestRepository;
	let subjectUtilRepository: SubjectsTestRepository;
	let videoUtilRepository: VideosTestRepository;
	let materialTestSdk: MaterialsTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const databaseProvider = app.get(DatabaseProvider);
		userUtilRepository = new UsersTestRepository(databaseProvider);
		materialUtilRepository = new MaterialsTestRepository(databaseProvider);
		markdownContentUtilRepository = new MarkDownContentTestRepository(databaseProvider);
		subjectUtilRepository = new SubjectsTestRepository(databaseProvider);
		videoUtilRepository = new VideosTestRepository(databaseProvider);

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
		await videoUtilRepository.clearAll();
	});

	it('Unauthenticated gets 401', async () => {
		const material = await createTestMaterial(
			userUtilRepository,
			markdownContentUtilRepository,
			subjectUtilRepository,
			materialUtilRepository,
		);

		const editDto: UpdateMaterialDto = {
			id: material.id,
			is_archived: false,
		};

		const res = await materialTestSdk.editMaterial({
			params: editDto,
			userMeta: {
				isAuth: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Fake JWT gets 401', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const material = await createTestMaterial(
			userUtilRepository,
			markdownContentUtilRepository,
			subjectUtilRepository,
			materialUtilRepository,
		);

		const editDto: UpdateMaterialDto = {
			id: material.id,
			is_archived: false,
		};

		const res = await materialTestSdk.editMaterial({
			params: editDto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: true,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Non-admin gets 401', async () => {
		const user = await createTestUser(userUtilRepository);
		const material = await createTestMaterial(
			userUtilRepository,
			markdownContentUtilRepository,
			subjectUtilRepository,
			materialUtilRepository,
		);

		const editDto: UpdateMaterialDto = {
			id: material.id,
			is_archived: false,
		};

		const res = await materialTestSdk.editMaterial({
			params: editDto,
			userMeta: {
				userId: user.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Admin can edit a material', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const material = await createTestMaterial(
			userUtilRepository,
			markdownContentUtilRepository,
			subjectUtilRepository,
			materialUtilRepository,
		);

		const newName = randomWord();
		const updatedMarkdown = '## ' + randomWord();
		const newStudent = await createTestUser(userUtilRepository);
		const newSubject = await createTestSubject(subjectUtilRepository);
		const newMarkdown = await createTestMarkdownContent(markdownContentUtilRepository, {
			content_text: '# Linked markdown content',
		});
		const newVideo = await createTestVideoRecord(videoUtilRepository, admin.id);

		const editDto: UpdateMaterialDto = {
			id: material.id,
			student_user_id: newStudent.id,
			subject_id: newSubject.id,
			name: newName,
			video_id: newVideo.id,
			markdown_content_id: newMarkdown.id,
			markdown_content: updatedMarkdown,
			is_archived: true,
		};

		const res = await materialTestSdk.editMaterial({
			params: editDto,
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status != 200) throw new Error();
		expect(res.body.name).to.equal(newName);
		expect(res.body.is_archived).to.equal(true);
		expect(res.body.student_user_id).to.equal(newStudent.id);
		expect(res.body.subject_id).to.equal(newSubject.id);
		expect(res.body.video_id).to.equal(newVideo.id);
		expect(res.body.markdown_content_id).to.equal(newMarkdown.id);
		expect(res.body.markdown_content).to.equal(updatedMarkdown);
	});

	it('Rejects removing both markdown and video content', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const video = await createTestVideoRecord(videoUtilRepository, admin.id);
		const material = await createTestMaterial(
			userUtilRepository,
			markdownContentUtilRepository,
			subjectUtilRepository,
			materialUtilRepository,
			{
				material: {
					video_id: video.id,
					markdown_content_id: null,
				},
			},
		);

		const res = await materialTestSdk.editMaterial({
			params: {
				id: material.id,
				video_id: null,
				markdown_content_id: null,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
	});

	it('Allows switching material content types', async () => {
		const admin = await createTestAdmin(userUtilRepository);
		const video = await createTestVideoRecord(videoUtilRepository, admin.id);
		const material = await createTestMaterial(
			userUtilRepository,
			markdownContentUtilRepository,
			subjectUtilRepository,
			materialUtilRepository,
		);

		const res = await materialTestSdk.editMaterial({
			params: {
				id: material.id,
				video_id: video.id,
				markdown_content_id: null,
			},
			userMeta: {
				userId: admin.id,
				isAuth: true,
				isWrongAccessJwt: false,
			},
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) throw new Error();
		expect(res.body.video_id).to.equal(video.id);
		expect(res.body.markdown_content_id).to.equal(null);
	});
});
