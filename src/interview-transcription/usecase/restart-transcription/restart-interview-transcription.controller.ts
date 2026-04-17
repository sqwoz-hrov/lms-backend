import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { RestartInterviewTranscriptionDto } from '../../dto/restart-interview-transcription.dto';
import { RestartInterviewTranscriptionUsecase } from './restart-interview-transcription.usecase';
import { LimitByFeature } from '../../../limits/common/limits.decorator';

@ApiTags('Interview Transcriptions')
@Controller('interview-transcriptions')
@Roles('admin', 'user', 'subscriber')
export class RestartInterviewTranscriptionController {
	constructor(private readonly usecase: RestartInterviewTranscriptionUsecase) {}

	@LimitByFeature('interview_transcription')
	@Route({
		summary: 'Перезапускает транскрибацию интервью',
		responseType: InterviewTranscriptionResponseDto,
		possibleErrors: [
			{
				status: HttpStatus.TOO_MANY_REQUESTS,
				description: 'Превышен лимит использования AI для транскрибации интервью',
			},
		],
	})
	@Post('restart')
	@HttpCode(HttpStatus.OK)
	async restart(
		@Body() dto: RestartInterviewTranscriptionDto,
		@Req() req: RequestWithUser,
	): Promise<InterviewTranscriptionResponseDto> {
		return await this.usecase.execute({ params: dto, user: req.user });
	}
}
