import { Controller, Get, HttpCode, HttpStatus, Param, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { BaseFeedbackDto } from '../../dto/base-feedback.dto';
import { GetFeedbackInfoUsecase } from './get-feedback-info.usecase';

@ApiTags('Feedback')
@Controller('feedback')
@Roles('admin', 'user')
export class GetFeedbackInfoController {
	constructor(private readonly getFeedbackInfoUsecase: GetFeedbackInfoUsecase) {}

	@Route({
		summary: 'Получает информацию о конкретном фидбеке',
		responseType: BaseFeedbackDto,
	})
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	async get(@Param('id') id: string, @Req() req: RequestWithUser): Promise<BaseFeedbackDto> {
		const user = req['user'];
		return this.getFeedbackInfoUsecase.execute({ params: { id }, user });
	}
}
