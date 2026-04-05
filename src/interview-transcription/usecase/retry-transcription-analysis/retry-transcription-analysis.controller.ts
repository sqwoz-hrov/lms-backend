import { Controller, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { RetryTranscriptionAnalysisParamsDto } from '../../../interview-transcription-report/dto/retry-transcription-analysis.dto';
import { RetryTranscriptionAnalysisUsecase } from './retry-transcription-analysis.usecase';

@ApiTags('Interview Transcription Reports')
@Controller('interview-transcription')
@Roles('admin', 'user', 'subscriber')
export class RetryTranscriptionAnalysisController {
	constructor(private readonly usecase: RetryTranscriptionAnalysisUsecase) {}

	@Route({
		summary: 'Перезапускает только аналитику для готовой транскрибации',
		responseType: InterviewTranscriptionResponseDto,
		possibleErrors: [
			{ status: HttpStatus.NOT_FOUND, description: 'Транскрибация не найдена' },
			{ status: HttpStatus.FORBIDDEN, description: 'Доступ к транскрибации запрещён' },
			{ status: HttpStatus.BAD_REQUEST, description: 'Транскрибация ещё не готова для повторной аналитики' },
		],
	})
	@Post(':transcription_id/retry-analysis')
	@HttpCode(HttpStatus.OK)
	async retryAnalysis(
		@Param() params: RetryTranscriptionAnalysisParamsDto,
		@Req() req: RequestWithUser,
	): Promise<InterviewTranscriptionResponseDto> {
		return await this.usecase.execute({ params, user: req.user });
	}
}
