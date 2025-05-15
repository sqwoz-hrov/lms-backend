import { Body, Controller, HttpCode, HttpStatus, InternalServerErrorException, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { BaseFeedbackDto } from '../../dto/base-feedback.dto';
import { CreateFeedbackDto } from '../../dto/create-feedback.dto';
import { CreateFeedbackUsecase } from './create-feedback.usecase';

@ApiTags('Feedback')
@Controller('feedback')
@Roles('admin')
export class CreateFeedbackController {
	constructor(private readonly createUsecase: CreateFeedbackUsecase) {}

	@Route({
		summary: 'Создает фидбек',
		responseType: BaseFeedbackDto,
	})
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(@Body() dto: CreateFeedbackDto): Promise<BaseFeedbackDto> {
		const feedback = await this.createUsecase.execute(dto);

		if (!feedback) {
			throw new InternalServerErrorException('Фидбек не создан');
		}

		return feedback;
	}
}
