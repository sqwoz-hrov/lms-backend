import { Module } from '@nestjs/common';
import { CreatePostController } from './usecases/create-post/create-post.controller';
import { UpdatePostController } from './usecases/update-post/update-post.controller';
import { DeletePostController } from './usecases/delete-post/delete-post.controller';
import { CreatePostUsecase } from './usecases/create-post/create-post.usecase';
import { UpdatePostUsecase } from './usecases/update-post/update-post.usecase';
import { DeletePostUsecase } from './usecases/delete-post/delete-post.usecase';
import { PostRepository } from './post.repository';
import { ListPostsController } from './usecases/list-posts/list-posts.controller';
import { ListPostsUsecase } from './usecases/list-posts/list-posts.usecase';
import { OpenPostForTiersController } from './usecases/open-for-tiers/open-for-tiers.controller';
import { OpenPostForTiersUsecase } from './usecases/open-for-tiers/open-for-tiers.usecase';
import { GetPostController } from './usecases/get-post/get-post.controller';
import { GetPostUsecase } from './usecases/get-post/get-post.usecase';

@Module({
	controllers: [
		CreatePostController,
		UpdatePostController,
		DeletePostController,
		ListPostsController,
		GetPostController,
		OpenPostForTiersController,
	],
	providers: [
		CreatePostUsecase,
		UpdatePostUsecase,
		DeletePostUsecase,
		ListPostsUsecase,
		GetPostUsecase,
		OpenPostForTiersUsecase,
		PostRepository,
	],
})
export class PostModule {}
