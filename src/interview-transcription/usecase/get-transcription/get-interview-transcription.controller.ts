import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { GetInterviewTranscriptionDto } from '../../dto/get-interview-transcription.dto';
import { GetInterviewTranscriptionUsecase } from './get-interview-transcription.usecase';

@ApiTags('Interview Transcriptions')
@Controller('interview-transcriptions')
@Roles('admin', 'user', 'subscriber')
export class GetInterviewTranscriptionController {
	constructor(private readonly usecase: GetInterviewTranscriptionUsecase) {}

	@Route({
		summary: 'Возвращает транскрибацию интервью по идентификатору видео',
		responseType: InterviewTranscriptionResponseDto,
	})
	@Get('get-transcription')
	@HttpCode(HttpStatus.OK)
	async get(
		@Query() query: GetInterviewTranscriptionDto,
		@Req() req: RequestWithUser,
	): Promise<InterviewTranscriptionResponseDto> {
		return await this.usecase.execute({ params: query, user: req.user });
	}
}
