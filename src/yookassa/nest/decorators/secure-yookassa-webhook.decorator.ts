import { UseGuards, applyDecorators } from '@nestjs/common';
import { YookassaWebhookGuard } from '../guards/yookassa-webhook.guard';

export const SecureYookassaWebhook = () => applyDecorators(UseGuards(YookassaWebhookGuard));
