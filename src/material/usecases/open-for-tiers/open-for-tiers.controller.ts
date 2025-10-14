import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { OpenMaterialForTiersDto } from '../../dto/open-material-for-tiers.dto';
import { OpenMaterialForTiersUsecase } from './open-for-tiers.usecase';

@ApiTags('Materials')
@Controller('materials')
@Roles('admin')
export class OpenMaterialForTiersController {
	constructor(private readonly openMaterialForTiersUsecase: OpenMaterialForTiersUsecase) {}

	@Route({
		summary: 'Открывает доступ к учебному материалу для подписочных уровней',
		responseType: Object,
	})
	@Post(':id/open-for-tiers')
	@HttpCode(HttpStatus.CREATED)
	async open(@Param('id') materialId: string, @Body() dto: OpenMaterialForTiersDto): Promise<void> {
		await this.openMaterialForTiersUsecase.execute({
			materialId,
			tierIds: dto.tier_ids,
		});
	}
}
