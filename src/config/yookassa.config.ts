import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const yookassaConfig = registerAs('yookassa', () => ({
	apiUrl: get('YOOKASSA_API_URL').default('https://api.yookassa.ru/v3').asString(),
	shopId: get('YOOKASSA_SHOP_ID').required().asString(),
	secretKey: get('YOOKASSA_SECRET_KEY').required().asString(),
	webhookUrl: get('YOOKASSA_WEBHOOK_URL').required().asString(),
	defaultReturnUrl: get('YOOKASSA_DEFAULT_RETURN_URL').default('').asString() || undefined,
}));
