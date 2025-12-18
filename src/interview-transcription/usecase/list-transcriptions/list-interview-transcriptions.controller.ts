import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { ListInterviewTranscriptionsDto } from '../../dto/list-interview-transcriptions.dto';
import { ListInterviewTranscriptionsUsecase } from './list-interview-transcriptions.usecase';

@ApiTags('Interview Transcriptions')
@Controller('interview-transcriptions')
@Roles('admin', 'user', 'subscriber')
export class ListInterviewTranscriptionsController {
	constructor(private readonly usecase: ListInterviewTranscriptionsUsecase) {}

	@Route({
		summary: 'Возвращает список транскрибаций интервью пользователя',
		responseType: InterviewTranscriptionResponseDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	async list(
		@Query() query: ListInterviewTranscriptionsDto,
		@Req() req: RequestWithUser,
	): Promise<InterviewTranscriptionResponseDto[]> {
		return await this.usecase.execute({ user: req.user, params: query });
	}
}
