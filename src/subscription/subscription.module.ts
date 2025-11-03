import { Module } from '@nestjs/common';
import { GiftSubscriptionController } from './usecases/gift-subscription/gift-subscription.controller';
import { GiftSubscriptionUsecase } from './usecases/gift-subscription/gift-subscription.usecase';
import { SubscriptionRepository } from './subscription.repository';
import { SubscriptionTierRepository } from './subscription-tier.repository';
import { SubscriptionManagerFactory } from './domain/subscription-manager.factory';
import { SubscriptionActionExecutor } from './services/subscription-action.executor';
import { HandleYookassaWebhookController } from './usecases/handle-yookassa-webhook/handle-yookassa-webhook.controller';
import { HandleYookassaWebhookUsecase } from './usecases/handle-yookassa-webhook/handle-yookassa-webhook.usecase';
import { YookassaModule } from '../yookassa/yookassa.module';

@Module({
	imports: [YookassaModule],
	controllers: [GiftSubscriptionController, HandleYookassaWebhookController],
	providers: [
		GiftSubscriptionUsecase,
		HandleYookassaWebhookUsecase,
		SubscriptionRepository,
		SubscriptionTierRepository,
		SubscriptionManagerFactory,
		SubscriptionActionExecutor,
	],
	exports: [SubscriptionRepository, SubscriptionTierRepository, SubscriptionManagerFactory, SubscriptionActionExecutor],
})
export class SubscriptionModule {}
