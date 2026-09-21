import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HandleYookassaWebhookUsecase } from './handle-yookassa-webhook.usecase';
import { Route } from '../../../common/nest/decorators/route.decorator';

@ApiTags('Webhooks')
@Controller('/webhooks/yookassa')
export class HandleYookassaWebhookController {
	constructor(private readonly usecase: HandleYookassaWebhookUsecase) {}

	@Route({ summary: 'Обработка вебхука от YooKassa' })
	@Post()
	@HttpCode(HttpStatus.OK)
	async handle(@Body() payload: unknown): Promise<void> {
		await this.usecase.execute(payload);
	}
}
