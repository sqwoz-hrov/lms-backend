import { Controller, Get, HttpCode, HttpStatus, Param, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { GetInterviewTranscriptionByVideoIdDto } from '../../dto/get-interview-transcription-by-video-id.dto';
import { GetInterviewTranscriptionByVideoIdUsecase } from './get-interview-transcription-by-video-id.usecase';

@ApiTags('Interview Transcriptions')
@Controller('interview-transcriptions')
@Roles('admin', 'user', 'subscriber')
export class GetInterviewTranscriptionByVideoIdController {
	constructor(private readonly usecase: GetInterviewTranscriptionByVideoIdUsecase) {}

	@Route({
		summary: 'Возвращает транскрибацию интервью по идентификатору видео',
		responseType: InterviewTranscriptionResponseDto,
	})
	@Get('by-video-id/:video_id')
	@HttpCode(HttpStatus.OK)
	async get(
		@Param() params: GetInterviewTranscriptionByVideoIdDto,
		@Req() req: RequestWithUser,
	): Promise<InterviewTranscriptionResponseDto> {
		return await this.usecase.execute({ params, user: req.user });
	}
}
