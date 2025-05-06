import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { MaterialResponseDto } from '../../dto/base-material.dto';
import { CreateMaterialDto } from '../../dto/create-material.dto';
import { CreateMaterialUsecase } from './create-material.usecase';

@ApiTags('Materials')
@Controller('materials')
@Roles('admin')
export class CreateMaterialController {
	constructor(private readonly createMaterialUsecase: CreateMaterialUsecase) {}

	@Route({
		summary: 'Создает учебный материал',
		responseType: MaterialResponseDto,
	})
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(@Body() dto: CreateMaterialDto): Promise<MaterialResponseDto> {
		return this.createMaterialUsecase.execute(dto);
	}
}
