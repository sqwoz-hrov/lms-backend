import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { InterviewTranscriptionWebhookDto } from '../../dto/interview-transcription-webhook.dto';
import { HandleTranscriptionFinishWebhookUsecase } from './handle-transcription-finish-webhook.usecase';

@ApiTags('Webhooks')
@Controller('/webhooks/interview-transcriptions')
export class HandleTranscriptionFinishWebhookController {
	constructor(private readonly usecase: HandleTranscriptionFinishWebhookUsecase) {}

	@Route({
		summary: 'Webhook завершения транскрибации интервью',
		responseType: InterviewTranscriptionResponseDto,
	})
	@Post('finish')
	@HttpCode(HttpStatus.OK)
	async handleFinish(@Body() dto: InterviewTranscriptionWebhookDto): Promise<InterviewTranscriptionResponseDto> {
		return await this.usecase.execute(dto);
	}
}
