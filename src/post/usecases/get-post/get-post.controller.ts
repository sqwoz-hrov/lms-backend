import { Controller, Get, HttpCode, HttpStatus, Param, Req } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { PostResponseDto } from '../../dto/base-post.dto';
import { GetPostUsecase } from './get-post.usecase';

@ApiTags('Posts')
@Controller('posts')
@Roles('admin', 'user', 'subscriber')
export class GetPostController {
	constructor(private readonly getPostUsecase: GetPostUsecase) {}

	@Route({
		summary: 'Получает пост по ID',
		responseType: PostResponseDto,
	})
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiParam({ name: 'id', description: 'ID или постоянная ссылка поста', type: String })
	async get(@Param('id') identifier: string, @Req() req: RequestWithUser): Promise<PostResponseDto> {
		const user = req['user'];

		return this.getPostUsecase.execute({ identifier, user });
	}
}
