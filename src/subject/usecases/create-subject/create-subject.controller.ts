import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { SubjectResponseDto } from '../../dto/base-subject.dto';
import { CreateSubjectDto } from '../../dto/create-subject.dto';
import { CreateSubjectUsecase } from './create-subject.usecase';

@ApiTags('Subjects')
@Controller('subjects')
@Roles('admin')
export class CreateSubjectController {
	constructor(private readonly createSubjectUsecase: CreateSubjectUsecase) {}

	@Route({
		summary: 'Создает предмет',
		responseType: SubjectResponseDto,
	})
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(@Body() dto: CreateSubjectDto): Promise<SubjectResponseDto> {
		return await this.createSubjectUsecase.execute(dto);
	}
}
