import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { GetInterviewsDto } from '../../dto/get-interviews.dto';
import { InterviewResponseDto } from '../../dto/base-interview.dto';
import { GetInterviewsUsecase } from './get-interviews.usecase';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('Interviews')
@Controller('interviews')
@Roles('admin', 'user')
export class GetInterviewsController {
	constructor(private readonly getUsecase: GetInterviewsUsecase) {}

	@Route({
		summary: 'Получает список интервью',
		responseType: InterviewResponseDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	get(@Query() query: GetInterviewsDto, @Req() req: RequestWithUser): Promise<InterviewResponseDto[]> {
		const user = req.user;
		return this.getUsecase.execute({ params: query, user });
	}
}
