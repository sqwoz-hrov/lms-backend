import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { StartInterviewTranscriptionDto } from '../../dto/start-interview-transcription.dto';
import { StartInterviewTranscriptionUsecase } from './start-interview-transcription.usecase';
import { LimitByFeature } from '../../../limits/common/limits.decorator';

@ApiTags('Interview Transcriptions')
@Controller('interview-transcriptions')
@Roles('admin', 'user', 'subscriber')
export class StartInterviewTranscriptionController {
	constructor(private readonly usecase: StartInterviewTranscriptionUsecase) {}

	@LimitByFeature('interview_transcription')
	@Route({
		summary: 'Запускает транскрибацию интервью',
		responseType: InterviewTranscriptionResponseDto,
		possibleErrors: [
			{
				status: HttpStatus.BAD_REQUEST,
				description: 'Неверные данные для запуска транскрибации',
			},
			{
				status: HttpStatus.NOT_FOUND,
				description: 'Интервью не найдено',
			},
			{
				status: HttpStatus.CONFLICT,
				description: 'Транскрибация уже запущена для данного интервью',
			},
			{
				status: HttpStatus.TOO_MANY_REQUESTS,
				description: 'Превышен лимит использования AI для транскрибации интервью',
			},
		],
	})
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async start(
		@Body() dto: StartInterviewTranscriptionDto,
		@Req() req: RequestWithUser,
	): Promise<InterviewTranscriptionResponseDto> {
		return await this.usecase.execute({ params: dto, user: req.user });
	}
}
