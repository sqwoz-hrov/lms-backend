import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Inject,
	Post,
	RawBodyRequest,
	Req,
	UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigType } from '@nestjs/config';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { InterviewTranscriptionWebhookDto } from '../../dto/interview-transcription-webhook.dto';
import { HandleTranscriptionFinishWebhookUsecase } from './handle-transcription-finish-webhook.usecase';
import { interviewTranscriptionConfig } from '../../../config';

@ApiTags('Webhooks')
@Controller('/webhooks/interview-transcriptions')
export class HandleTranscriptionFinishWebhookController {
	constructor(
		private readonly usecase: HandleTranscriptionFinishWebhookUsecase,
		@Inject(interviewTranscriptionConfig.KEY)
		private readonly config: ConfigType<typeof interviewTranscriptionConfig>,
	) {}

	@Route({
		summary: 'Webhook завершения транскрибации интервью',
		responseType: InterviewTranscriptionResponseDto,
	})
	@Post('finish')
	@HttpCode(HttpStatus.OK)
	async handleFinish(
		@Body() dto: InterviewTranscriptionWebhookDto,
		@Req() req: RawBodyRequest<Request>,
	): Promise<InterviewTranscriptionResponseDto> {
		this.verifySignature(req);
		return await this.usecase.execute(dto);
	}

	private verifySignature(req: RawBodyRequest<Request>): void {
		const secret = this.config.webhookSecret;
		if (!secret) {
			return;
		}

		const rawBody = req.rawBody;
		if (!rawBody || rawBody.length === 0) {
			throw new UnauthorizedException('Webhook payload missing for signature verification');
		}

		const headerKey = this.config.webhookSignatureHeader.toLowerCase();
		const headerValue = req.headers[headerKey];
		const providedSignature = Array.isArray(headerValue) ? headerValue[0] : headerValue;

		if (!providedSignature) {
			throw new UnauthorizedException('Missing webhook signature');
		}

		const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
		const providedBuffer = Buffer.from(providedSignature, 'utf8');
		const expectedBuffer = Buffer.from(expected, 'utf8');

		if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
			throw new UnauthorizedException('Invalid webhook signature');
		}
	}
}
