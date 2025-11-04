import { Body, Controller, HttpCode, HttpStatus, InternalServerErrorException, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { PostResponseDto } from '../../dto/base-post.dto';
import { UpdatePostDto } from '../../dto/update-post.dto';
import { UpdatePostUsecase } from './update-post.usecase';

@ApiTags('Posts')
@Controller('posts')
@Roles('admin')
export class UpdatePostController {
	constructor(private readonly updatePostUsecase: UpdatePostUsecase) {}

	@Route({
		summary: 'Обновляет пост',
		responseType: PostResponseDto,
	})
	@Put()
	@HttpCode(HttpStatus.OK)
	async update(@Body() dto: UpdatePostDto): Promise<PostResponseDto> {
		const post = await this.updatePostUsecase.execute(dto);

		if (!post) {
			throw new InternalServerErrorException('Пост не обновлен');
		}

		return post;
	}
}
