import { Body, Controller, HttpCode, HttpStatus, InternalServerErrorException, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { EditFeedbackUsecase } from './edit-feedback.usecase';
import { UpdateFeedbackDto } from '../../dto/update-feedback.dto';
import { FeedbackResponseDto } from '../../dto/base-feedback.dto';

@ApiTags('Feedback')
@Controller('feedback')
@Roles('admin')
export class EditFeedbackController {
	constructor(private readonly editUsecase: EditFeedbackUsecase) {}

	@Route({
		summary: 'Меняет фидбек',
		responseType: FeedbackResponseDto,
	})
	@Put()
	@HttpCode(HttpStatus.OK)
	async edit(@Body() dto: UpdateFeedbackDto): Promise<FeedbackResponseDto> {
		const result = await this.editUsecase.execute(dto);

		if (!result) {
			throw new InternalServerErrorException('Фидбек не изменен');
		}

		return result;
	}
}
