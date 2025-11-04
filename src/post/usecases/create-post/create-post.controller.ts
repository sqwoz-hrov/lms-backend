import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { PostResponseDto } from '../../dto/base-post.dto';
import { CreatePostDto } from '../../dto/create-post.dto';
import { CreatePostUsecase } from './create-post.usecase';

@ApiTags('Posts')
@Controller('posts')
@Roles('admin')
export class CreatePostController {
	constructor(private readonly createPostUsecase: CreatePostUsecase) {}

	@Route({
		summary: 'Создает пост',
		responseType: PostResponseDto,
	})
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(@Body() dto: CreatePostDto): Promise<PostResponseDto> {
		return await this.createPostUsecase.execute(dto);
	}
}
