import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { SubjectResponseDto } from '../../dto/base-subject.dto';
import { GetSubjectsUsecase } from './get-subjects.usecase';

@ApiTags('Subjects')
@Controller('subjects')
@Roles('admin', 'user')
export class GetSubjectsController {
	constructor(private readonly getSubjectsUsecase: GetSubjectsUsecase) {}

	@Route({
		summary: 'Получает список предметов',
		responseType: SubjectResponseDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	get(): Promise<SubjectResponseDto[]> {
		return this.getSubjectsUsecase.execute();
	}
}
