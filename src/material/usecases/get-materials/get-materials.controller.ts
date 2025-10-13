import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { MaterialResponseDto } from '../../dto/base-material.dto';
import { GetMaterialsDto } from '../../dto/get-materials.dto';
import { GetMaterialsUsecase } from './get-materials.usecase';

@ApiTags('Materials')
@Controller('materials')
@Roles('admin', 'user', 'subscriber')
export class GetMaterialsController {
	constructor(private readonly getMaterialsUsecase: GetMaterialsUsecase) {}

	@Route({
		summary: 'Получает список учебных материалов',
		responseType: MaterialResponseDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	async get(@Query() query: GetMaterialsDto, @Req() req: RequestWithUser): Promise<MaterialResponseDto[]> {
		const user = req['user'];
		return this.getMaterialsUsecase.execute({ user, params: query });
	}
}
