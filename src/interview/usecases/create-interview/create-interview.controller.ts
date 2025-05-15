import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { InterviewResponseDto } from '../../dto/base-interview.dto';
import { CreateInterviewDto } from '../../dto/create-interview.dto';
import { CreateInterviewUsecase } from './create-interview.usecase';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('Interviews')
@Controller('interviews')
@Roles('admin', 'user')
export class CreateInterviewController {
	constructor(private readonly createUsecase: CreateInterviewUsecase) {}

	@Route({
		summary: 'Создает интервью',
		responseType: InterviewResponseDto,
	})
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(@Body() dto: CreateInterviewDto, @Req() req: RequestWithUser): Promise<InterviewResponseDto> {
		const user = req.user;
		return await this.createUsecase.execute({ params: dto, user });
	}
}
