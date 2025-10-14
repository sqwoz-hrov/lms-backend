import { Controller, Get, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { SubjectResponseDto } from '../../dto/base-subject.dto';
import { GetSubjectsUsecase } from './get-subjects.usecase';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('Subjects')
@Controller('subjects')
@Roles('admin', 'user', 'subscriber')
export class GetSubjectsController {
	constructor(private readonly getSubjectsUsecase: GetSubjectsUsecase) {}

	@Route({
		summary: 'Получает список предметов',
		responseType: SubjectResponseDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	get(@Req() req: RequestWithUser): Promise<SubjectResponseDto[]> {
		const user = req['user'];

		return this.getSubjectsUsecase.execute(user);
	}
}
