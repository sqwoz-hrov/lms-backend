import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { PostResponseDto } from '../../dto/base-post.dto';
import { GetPostsDto } from '../../dto/get-posts.dto';
import { ListPostsUsecase } from './list-posts.usecase';

@ApiTags('Posts')
@Controller('posts')
@Roles('admin', 'user', 'subscriber')
export class ListPostsController {
	constructor(private readonly listPostsUsecase: ListPostsUsecase) {}

	@Route({
		summary: 'Получает список постов',
		responseType: PostResponseDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	async list(@Query() query: GetPostsDto, @Req() req: RequestWithUser): Promise<PostResponseDto[]> {
		const user = req['user'];
		return await this.listPostsUsecase.execute({ user, params: query });
	}
}
