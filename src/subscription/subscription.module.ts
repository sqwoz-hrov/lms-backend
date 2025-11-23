import { Module } from '@nestjs/common';
import { GiftSubscriptionController } from './usecases/gift-subscription/gift-subscription.controller';
import { GiftSubscriptionUsecase } from './usecases/gift-subscription/gift-subscription.usecase';
import { SubscriptionRepository } from './subscription.repository';
import { SubscriptionManagerFactory } from './domain/subscription-manager.factory';
import { SubscriptionActionExecutor } from './services/subscription-action.executor';
import { SubscriptionBillingService } from './services/subscription-billing.service';
import { SubscriptionBillingScheduler } from './services/subscription-billing.scheduler';
import { HandleYookassaWebhookController } from './usecases/handle-yookassa-webhook/handle-yookassa-webhook.controller';
import { HandleYookassaWebhookUsecase } from './usecases/handle-yookassa-webhook/handle-yookassa-webhook.usecase';
import { PaymentWebhookHandler } from './services/payment-webhook.handler';
import { PaymentMethodWebhookHandler } from './services/payment-method-webhook.handler';
import { YookassaModule } from '../yookassa/yookassa.module';
import { SubscriptionTierModule } from '../subscription-tier/subscription-tier.module';
import { SUBSCRIPTION_REPOSITORY_PORT } from './constants';
import { DowngradeSubscriptionController } from './usecases/downgrade-subscription/downgrade-subscription.controller';
import { DowngradeSubscriptionUsecase } from './usecases/downgrade-subscription/downgrade-subscription.usecase';
import { YookassaWebhookRouter } from './services/webhook-router';

@Module({
	imports: [YookassaModule, SubscriptionTierModule],
	controllers: [GiftSubscriptionController, DowngradeSubscriptionController, HandleYookassaWebhookController],
	providers: [
		GiftSubscriptionUsecase,
		DowngradeSubscriptionUsecase,
		HandleYookassaWebhookUsecase,
		PaymentWebhookHandler,
		PaymentMethodWebhookHandler,
		YookassaWebhookRouter,
		SubscriptionRepository,
		{
			provide: SUBSCRIPTION_REPOSITORY_PORT,
			useExisting: SubscriptionRepository,
		},
		SubscriptionManagerFactory,
		SubscriptionActionExecutor,
		SubscriptionBillingService,
		SubscriptionBillingScheduler,
	],
	exports: [SubscriptionRepository, SubscriptionManagerFactory, SubscriptionActionExecutor],
})
export class SubscriptionModule {}
