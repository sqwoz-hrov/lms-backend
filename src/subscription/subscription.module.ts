import { forwardRef, Module } from '@nestjs/common';
import { SubscriptionRepository } from './subscription.repository';
import { SubscriptionBillingService } from './services/subscription-billing.service';
import { SubscriptionBillingScheduler } from './services/subscription-billing.scheduler';
import { HandleYookassaWebhookController } from './usecases/handle-yookassa-webhook/handle-yookassa-webhook.controller';
import { HandleYookassaWebhookUsecase } from './usecases/handle-yookassa-webhook/handle-yookassa-webhook.usecase';
import { PaymentWebhookHandlerStrategy } from './usecases/handle-yookassa-webhook/strategies/payment-webhook.strategy';
import { PaymentMethodWebhookHandlerStrategy } from './usecases/handle-yookassa-webhook/strategies/payment-method-webhook.strategy';
import { YookassaModule } from '../yookassa/yookassa.module';
import { SubscriptionTierModule } from '../subscription-tier/subscription-tier.module';
import { SUBSCRIPTION_REPOSITORY_PORT } from './constants';
import { DowngradeSubscriptionController } from './usecases/downgrade-subscription/downgrade-subscription.controller';
import { DowngradeSubscriptionUsecase } from './usecases/downgrade-subscription/downgrade-subscription.usecase';
import { YookassaWebhookRouter } from './usecases/handle-yookassa-webhook/strategies/webhook-router';
import { SubscriptionStateService } from './domain/subscription.state';
import { SubscriptionService } from './services/subscription.service';
import { GiftModule } from '../gift/gift.module';

@Module({
	imports: [YookassaModule, SubscriptionTierModule, forwardRef(() => GiftModule)],
	controllers: [DowngradeSubscriptionController, HandleYookassaWebhookController],
	providers: [
		DowngradeSubscriptionUsecase,
		HandleYookassaWebhookUsecase,
		PaymentWebhookHandlerStrategy,
		PaymentMethodWebhookHandlerStrategy,
		YookassaWebhookRouter,
		SubscriptionRepository,
		{
			provide: SUBSCRIPTION_REPOSITORY_PORT,
			useExisting: SubscriptionRepository,
		},
		SubscriptionStateService,
		SubscriptionService,
		SubscriptionBillingService,
		SubscriptionBillingScheduler,
	],
	exports: [SubscriptionRepository, SubscriptionService, SubscriptionStateService],
})
export class SubscriptionModule {}
