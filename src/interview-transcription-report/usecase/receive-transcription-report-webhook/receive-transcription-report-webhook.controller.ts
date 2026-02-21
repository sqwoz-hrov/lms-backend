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
import { ReceiveTranscriptionReportWebhookDto } from '../../dto/receive-transcription-report-webhook.dto';
import { ReceiveTranscriptionReportWebhookUsecase } from './receive-transcription-report-webhook.usecase';
import { interviewTranscriptionConfig } from '../../../config';

@ApiTags('Webhooks')
@Controller('/webhooks/interview-transcription-reports')
export class InterviewTranscriptionReportController {
	constructor(
		private readonly usecase: ReceiveTranscriptionReportWebhookUsecase,
		@Inject(interviewTranscriptionConfig.KEY)
		private readonly config: ConfigType<typeof interviewTranscriptionConfig>,
	) {}

	@Route({
		summary: 'Webhook получения отчёта транскрибации интервью',
		requestBodyType: ReceiveTranscriptionReportWebhookDto,
	})
	@Post('receive')
	@HttpCode(HttpStatus.OK)
	async receive(@Body() body: unknown, @Req() req: RawBodyRequest<Request>): Promise<void> {
		this.verifySignature(req);
		await this.usecase.execute({ params: body });
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
