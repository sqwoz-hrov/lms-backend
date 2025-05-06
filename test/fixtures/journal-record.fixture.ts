import { CreateJournalRecordDto } from '../../src/journal-record/dto/create-journal-record.dto';
import { JournalRecord } from '../../src/journal-record/journal-record.entity';
import { JournalRecordsTestRepository } from '../../src/journal-record/test-utils/test.repo';
import { MarkDownContent } from '../../src/markdown-content/markdown-content.entity';
import { MarkDownContentTestRepository } from '../../src/markdown-content/test-utils/test.repo';
import { UsersTestRepository } from '../../src/user/test-utils/test.repo';
import { User } from '../../src/user/user.entity';
import { randomWord } from './common.fixture';
import { createTestMarkdownContent } from './markdown-content.fixture';
import { createTestUser } from './user.fixture';

export const createTestJournalRecordDto = (
	studentId: string,
	overrides: Partial<CreateJournalRecordDto> = {},
): CreateJournalRecordDto => {
	return {
		student_user_id: studentId,
		name: randomWord(),
		markdown_content: '# Journal Entry Content',
		...overrides,
	};
};

export const createTestJournalRecord = async (
	userRepository: UsersTestRepository,
	markdownContentRepository: MarkDownContentTestRepository,
	journalRecordRepository: JournalRecordsTestRepository,
	userOverrides: Partial<User> = {},
	markdownContentOverrides: Partial<MarkDownContent> = {},
	journalRecordOverrides: Partial<JournalRecord> = {},
): Promise<JournalRecord> => {
	const student_user_id = journalRecordOverrides.student_user_id
		? journalRecordOverrides.student_user_id
		: (await createTestUser(userRepository, userOverrides)).id;

	const markdownContent = await createTestMarkdownContent(markdownContentRepository, markdownContentOverrides);

	return journalRecordRepository.connection
		.insertInto('journal_record')
		.values({
			student_user_id,
			name: randomWord(),
			markdown_content_id: markdownContent.id,
			...journalRecordOverrides,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
};
