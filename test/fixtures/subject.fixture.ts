import { CreateSubjectDto } from '../../src/subject/dto/create-subject.dto';
import { SubjectsTestRepository } from '../../src/subject/test-utils/test.repo';
import { Subject } from '../../src/subject/subject.entity';
import { randomWord } from './common.fixture';

export const createTestSubjectDto = (overrides: Partial<CreateSubjectDto> = {}): CreateSubjectDto => {
	return {
		name: randomWord(),
		color_code: '#123ABC',
		...overrides,
	};
};

export const createTestSubject = async (
	subjectRepository: SubjectsTestRepository,
	overrides: Partial<Subject> = {},
): Promise<Subject> => {
	const subject = {
		name: randomWord(),
		color_code: '#123ABC',
		...overrides,
	};

	return subjectRepository.connection.insertInto('subject').values(subject).returningAll().executeTakeFirstOrThrow();
};
