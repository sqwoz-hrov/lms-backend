import { Module } from '@nestjs/common';
import { CreatePostController } from './usecases/create-post/create-post.controller';
import { UpdatePostController } from './usecases/update-post/update-post.controller';
import { DeletePostController } from './usecases/delete-post/delete-post.controller';
import { CreatePostUsecase } from './usecases/create-post/create-post.usecase';
import { UpdatePostUsecase } from './usecases/update-post/update-post.usecase';
import { DeletePostUsecase } from './usecases/delete-post/delete-post.usecase';
import { PostRepository } from './post.repository';

@Module({
	controllers: [CreatePostController, UpdatePostController, DeletePostController],
	providers: [CreatePostUsecase, UpdatePostUsecase, DeletePostUsecase, PostRepository],
})
export class PostModule {}
