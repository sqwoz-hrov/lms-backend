import { MarkDownContent } from '../../src/markdown-content/markdown-content.entity';
import { MarkDownContentTestRepository } from '../../src/markdown-content/test-utils/test.repo';
import { CreateMaterialDto } from '../../src/material/dto/create-material.dto';
import { Material } from '../../src/material/material.entity';
import { MaterialsTestRepository } from '../../src/material/test-utils/test.repo';
import { Subject } from '../../src/subject/subject.entity';
import { SubjectsTestRepository } from '../../src/subject/test-utils/test.repo';
import { UsersTestRepository } from '../../src/user/test-utils/test.repo';
import { User } from '../../src/user/user.entity';
import { randomWord } from './common.fixture';
import { createTestMarkdownContent } from './markdown-content.fixture';
import { createTestSubject } from './subject.fixture';
import { createTestUser } from './user.fixture';

export const createTestMaterialDto = (
	subjectId: string,
	overrides: Partial<CreateMaterialDto> = {},
): CreateMaterialDto => {
	return {
		subject_id: subjectId,
		name: randomWord(),
		video_id: undefined,
		markdown_content: '# Example material content',
		...overrides,
	};
};

export const createTestMaterial = async (
	userRepository: UsersTestRepository,
	markdownContentRepository: MarkDownContentTestRepository,
	subjectRepository: SubjectsTestRepository,
	materialRepository: MaterialsTestRepository,
	overrides: {
		user?: Partial<User>;
		markdown?: Partial<MarkDownContent>;
		subject?: Partial<Subject>;
		material?: Partial<Material>;
	} = {},
) => {
	const student_user_id =
		overrides.material?.student_user_id ?? (await createTestUser(userRepository, overrides.user ?? {})).id;

	const markdownContent = await createTestMarkdownContent(markdownContentRepository, overrides.markdown ?? {});
	const subject = await createTestSubject(subjectRepository, overrides.subject ?? {});

	return materialRepository.connection
		.insertInto('material')
		.values({
			student_user_id,
			subject_id: subject.id,
			name: overrides.material?.name ?? randomWord(),
			video_id: overrides.material?.video_id,
			markdown_content_id: markdownContent.id,
			...overrides.material,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
};
