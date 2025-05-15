import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { GetAllFeedbackDto } from '../../dto/get-all-feedback.dto';
import { BaseFeedbackDto } from '../../dto/base-feedback.dto';
import { GetAllFeedbackUsecase } from './get-all-feedback.usecase';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('Feedback')
@Controller('feedback')
@Roles('admin', 'user')
export class GetAllFeedbackController {
	constructor(private readonly getAllFeedbackUsecase: GetAllFeedbackUsecase) {}

	@Route({
		summary: 'Получает список фидбека',
		responseType: BaseFeedbackDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	async get(@Query() query: GetAllFeedbackDto, @Req() req: RequestWithUser): Promise<BaseFeedbackDto[]> {
		const user = req['user'];
		return this.getAllFeedbackUsecase.execute({ params: query, user });
	}
}
