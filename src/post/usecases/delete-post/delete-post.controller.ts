import { Body, Controller, Delete, HttpCode, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { PostResponseDto } from '../../dto/base-post.dto';
import { DeletePostDto } from '../../dto/delete-post.dto';
import { DeletePostUsecase } from './delete-post.usecase';

@ApiTags('Posts')
@Controller('posts')
@Roles('admin')
export class DeletePostController {
	constructor(private readonly deletePostUsecase: DeletePostUsecase) {}

	@Route({
		summary: 'Удаляет пост',
		responseType: PostResponseDto,
	})
	@Delete()
	@HttpCode(HttpStatus.OK)
	async delete(@Body() dto: DeletePostDto): Promise<PostResponseDto> {
		const post = await this.deletePostUsecase.execute(dto);

		if (!post) {
			throw new InternalServerErrorException('Пост не удален');
		}

		return post;
	}
}
