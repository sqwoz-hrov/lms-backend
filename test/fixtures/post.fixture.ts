import { MarkDownContent } from '../../src/markdown-content/markdown-content.entity';
import { MarkDownContentTestRepository } from '../../src/markdown-content/test-utils/test.repo';
import { CreatePostDto } from '../../src/post/dto/create-post.dto';
import { Post } from '../../src/post/post.entity';
import { PostsTestRepository } from '../../src/post/test-utils/test.repo';
import { randomWord } from './common.fixture';
import { createTestMarkdownContent } from './markdown-content.fixture';

export const createTestPostDto = (overrides: Partial<CreatePostDto> = {}): CreatePostDto => ({
	title: randomWord(),
	markdown_content: '# Sample post content',
	video_id: undefined,
	...overrides,
});

export const createTestPost = async (
	postsRepository: PostsTestRepository,
	markdownRepository: MarkDownContentTestRepository,
	overrides: {
		post?: Partial<Post>;
		markdown?: Partial<MarkDownContent>;
	} = {},
) => {
	const markdown = await createTestMarkdownContent(markdownRepository, overrides.markdown ?? {});

	const postValues = {
		...overrides.post,
		title: overrides.post?.title ?? randomWord(),
		markdown_content_id: overrides.post?.markdown_content_id ?? markdown.id,
		video_id: overrides.post?.video_id ?? null,
	};

	const inserted = await postsRepository.db
		.insertInto('post')
		.values(postValues)
		.returningAll()
		.executeTakeFirstOrThrow();

	return {
		post: inserted,
		markdown,
	};
};
