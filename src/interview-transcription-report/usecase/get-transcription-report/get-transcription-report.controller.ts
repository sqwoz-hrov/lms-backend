import { Controller, Get, HttpCode, HttpStatus, Param, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { InterviewTranscriptionReportResponseDto } from '../../dto/interview-transcription-report-response.dto';
import { GetTranscriptionReportUsecase } from './get-transcription-report.usecase';
import { GetTranscriptionReportParams } from '../../dto/get-transcription-report.dto';

@ApiTags('Interview Transcription Reports')
@Controller('interview-transcription-reports')
@Roles('admin', 'user', 'subscriber')
export class GetTranscriptionReportController {
	constructor(private readonly usecase: GetTranscriptionReportUsecase) {}

	@Route({
		summary: 'Возвращает отчёт транскрибации интервью',
		responseType: InterviewTranscriptionReportResponseDto,
		possibleErrors: [
			{
				status: HttpStatus.NOT_FOUND,
				description: 'Транскрибация или отчёт не найдены',
			},
			{
				status: HttpStatus.FORBIDDEN,
				description: 'Доступ к отчёту запрещён',
			},
		],
	})
	@Get(':transcription_id')
	@HttpCode(HttpStatus.OK)
	async get(
		@Param() params: GetTranscriptionReportParams,
		@Req() req: RequestWithUser,
	): Promise<InterviewTranscriptionReportResponseDto> {
		return await this.usecase.execute({ params, user: req.user });
	}
}
