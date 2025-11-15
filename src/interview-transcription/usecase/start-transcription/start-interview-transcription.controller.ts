import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { StartInterviewTranscriptionDto } from '../../dto/start-interview-transcription.dto';
import { StartInterviewTranscriptionUsecase } from './start-interview-transcription.usecase';

@ApiTags('Interview Transcriptions')
@Controller('interview-transcriptions')
@Roles('admin', 'user', 'subscriber')
export class StartInterviewTranscriptionController {
	constructor(private readonly usecase: StartInterviewTranscriptionUsecase) {}

	@Route({
		summary: 'Запускает транскрибацию интервью',
		responseType: InterviewTranscriptionResponseDto,
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
