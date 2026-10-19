import { DynamicModule, forwardRef, Module } from '@nestjs/common';
import { YOOKASSA_CLIENT } from './constants';
import { YookassaClient } from './services/yookassa.client';
import { FakeYookassaClient } from './services/fake-yookassa.client';
import { YookassaWebhookGuard } from './nest/guards/yookassa-webhook.guard';
import { HandleYookassaWebhookController } from './usecases/handle-yookassa-webhook/handle-yookassa-webhook.controller';
import { HandleYookassaWebhookUsecase } from './usecases/handle-yookassa-webhook/handle-yookassa-webhook.usecase';
import { PaymentWebhookHandlerStrategy } from './usecases/handle-yookassa-webhook/strategies/payment-webhook.strategy';
import { PaymentMethodWebhookHandlerStrategy } from './usecases/handle-yookassa-webhook/strategies/payment-method-webhook.strategy';
import { YookassaWebhookRouter } from './usecases/handle-yookassa-webhook/strategies/webhook-router';
import { SecureYookassaWebhook } from './nest/decorators/secure-yookassa-webhook.decorator';
import { SubscriptionModule } from '../subscription/subscription.module';
import { GiftModule } from '../gift/gift.module';

@Module({})
export class YookassaModule {
	static forRoot({ useYookassaAPI }: { useYookassaAPI: boolean }): DynamicModule {
		const commonProviders = [
			YookassaWebhookGuard,
			HandleYookassaWebhookUsecase,
			PaymentWebhookHandlerStrategy,
			PaymentMethodWebhookHandlerStrategy,
			YookassaWebhookRouter,
		];
		const imports = [forwardRef(() => SubscriptionModule), GiftModule];

		if (useYookassaAPI) {
			// apply the decorator
			SecureYookassaWebhook()(HandleYookassaWebhookController);

			return {
				module: YookassaModule,
				global: true,
				imports,
				providers: [
					...commonProviders,
					{
						provide: YOOKASSA_CLIENT,
						useClass: YookassaClient,
					},
				],
				exports: [...commonProviders, YOOKASSA_CLIENT],
				controllers: [HandleYookassaWebhookController],
			};
		}

		return {
			module: YookassaModule,
			global: true,
			imports,
			providers: [
				...commonProviders,
				{
					provide: YOOKASSA_CLIENT,
					useClass: FakeYookassaClient,
				},
			],
			exports: [...commonProviders, YOOKASSA_CLIENT],
			controllers: [HandleYookassaWebhookController],
		};
	}
}
