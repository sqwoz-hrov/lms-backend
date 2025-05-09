import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { MaterialResponseDto } from '../../dto/base-material.dto';
import { ArchiveMaterialDto } from '../../dto/archive-material.dto';
import { ArchiveMaterialUsecase } from './archive-material.usecase';

@ApiTags('Materials')
@Controller('materials/archive')
@Roles('admin')
export class ArchiveMaterialController {
	constructor(private readonly archiveMaterialUsecase: ArchiveMaterialUsecase) {}

	@Route({
		summary: 'Архивирует или разархивирует учебный материал',
		responseType: MaterialResponseDto,
	})
	@Put()
	@HttpCode(HttpStatus.OK)
	async archive(@Body() dto: ArchiveMaterialDto): Promise<MaterialResponseDto> {
		return this.archiveMaterialUsecase.execute(dto);
	}
}
