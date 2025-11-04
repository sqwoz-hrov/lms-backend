import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { OpenPostForTiersDto } from '../../dto/open-post-for-tiers.dto';
import { OpenPostForTiersUsecase } from './open-for-tiers.usecase';

@ApiTags('Posts')
@Controller('posts')
@Roles('admin')
export class OpenPostForTiersController {
	constructor(private readonly openPostForTiersUsecase: OpenPostForTiersUsecase) {}

	@Route({
		summary: 'Открывает доступ к посту для подписочных уровней',
		responseType: Object,
	})
	@Post(':id/open-for-tiers')
	@HttpCode(HttpStatus.CREATED)
	async open(@Param('id') postId: string, @Body() dto: OpenPostForTiersDto): Promise<void> {
		await this.openPostForTiersUsecase.execute({
			postId,
			tierIds: dto.tier_ids,
		});
	}
}
