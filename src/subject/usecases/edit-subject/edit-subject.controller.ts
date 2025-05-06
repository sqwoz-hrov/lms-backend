import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { SubjectResponseDto } from '../../dto/base-subject.dto';
import { UpdateSubjectDto } from '../../dto/update-subject.dto';
import { EditSubjectUsecase } from './edit-subject.usecase';

@ApiTags('Subjects')
@Controller('subjects')
@Roles('admin')
export class EditSubjectController {
	constructor(private readonly editSubjectUsecase: EditSubjectUsecase) {}

	@Route({
		summary: 'Редактирует предмет',
		responseType: SubjectResponseDto,
	})
	@Put()
	@HttpCode(HttpStatus.OK)
	async update(@Body() dto: UpdateSubjectDto): Promise<SubjectResponseDto> {
		return await this.editSubjectUsecase.execute(dto);
	}
}
