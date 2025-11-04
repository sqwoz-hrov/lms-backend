import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { CreatePostDto } from '../dto/create-post.dto';
import { PostResponseDto } from '../dto/base-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { DeletePostDto } from '../dto/delete-post.dto';
import { GetPostsDto } from '../dto/get-posts.dto';
import { OpenPostForTiersDto } from '../dto/open-post-for-tiers.dto';

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

	async getPosts({ query, userMeta }: { query?: Partial<GetPostsDto>; userMeta: UserMeta }) {
		let path = '/posts';

		if (query && Object.keys(query).length > 0) {
			const queryParams = new URLSearchParams();

			for (const [key, value] of Object.entries(query)) {
				if (value === undefined || value === null) {
					continue;
				}

				queryParams.append(key, String(value));
			}

			const queryString = queryParams.toString();
			if (queryString) {
				path = `${path}?${queryString}`;
			}
		}

		return this.testClient.request<PostResponseDto[]>({
			path,
			method: 'GET',
			userMeta,
		});
	}

	async getPostById({ params, userMeta }: { params: { id: string }; userMeta: UserMeta }) {
		return this.testClient.request<PostResponseDto>({
			path: `/posts/${params.id}`,
			method: 'GET',
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

	async openPostForTiers({
		postId,
		params,
		userMeta,
	}: {
		postId: string;
		params: OpenPostForTiersDto;
		userMeta: UserMeta;
	}) {
		return this.testClient.request<void>({
			path: `/posts/${postId}/open-for-tiers`,
			method: 'POST',
			body: params,
			userMeta,
		});
	}
}
