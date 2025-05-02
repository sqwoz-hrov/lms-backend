import { v7 } from 'uuid';
import { MarkDownContent } from '../../src/markdown-content/markdown-content.entity';
import { MarkDownContentTestRepository } from '../../src/markdown-content/test-utils/test.repo';

export const createTestMarkdownContent = async (
	markdownContentRepotory: MarkDownContentTestRepository,
	overrides: Partial<MarkDownContent> = {},
) => {
	return markdownContentRepotory.connection
		.insertInto('markdown_content')
		.values({
			id: v7(),
			content_text: '# Sample content',
			...overrides,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
};
