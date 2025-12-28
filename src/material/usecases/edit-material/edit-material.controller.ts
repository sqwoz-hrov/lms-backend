import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { MaterialResponseDto } from '../../dto/material-response.dto';
import { UpdateMaterialDto } from '../../dto/update-material.dto';
import { EditMaterialUsecase } from './edit-material.usecase';

@ApiTags('Materials')
@Controller('materials')
@Roles('admin')
export class EditMaterialController {
	constructor(private readonly editMaterialUsecase: EditMaterialUsecase) {}

	@Route({
		summary: 'Обновляет учебный материал',
		responseType: MaterialResponseDto,
	})
	@Put()
	@HttpCode(HttpStatus.OK)
	async update(@Body() dto: UpdateMaterialDto): Promise<MaterialResponseDto> {
		return this.editMaterialUsecase.execute(dto);
	}
}
