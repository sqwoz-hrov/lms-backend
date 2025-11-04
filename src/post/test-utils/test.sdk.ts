import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { CreatePostDto } from '../dto/create-post.dto';
import { PostResponseDto } from '../dto/base-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { DeletePostDto } from '../dto/delete-post.dto';

export class PostsTestSdk implements ValidateSDK<PostsTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	async createPost({ params, userMeta }: { params: CreatePostDto; userMeta: UserMeta }) {
		return this.testClient.request<PostResponseDto>({
			path: '/posts',
			method: 'POST',
			body: params,
			userMeta,
		});
	}

	async updatePost({ params, userMeta }: { params: UpdatePostDto; userMeta: UserMeta }) {
		return this.testClient.request<PostResponseDto>({
			path: '/posts',
			method: 'PUT',
			body: params,
			userMeta,
		});
	}

	async deletePost({ params, userMeta }: { params: DeletePostDto; userMeta: UserMeta }) {
		return this.testClient.request<PostResponseDto>({
			path: '/posts',
			method: 'DELETE',
			body: params,
			userMeta,
		});
	}
}
