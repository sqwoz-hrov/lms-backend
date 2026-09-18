import { forwardRef, Module } from '@nestjs/common';
import { SubscriptionRepository } from './subscription.repository';
import { SubscriptionBillingService } from './services/subscription-billing.service';
import { SubscriptionBillingScheduler } from './services/subscription-billing.scheduler';
import { YookassaModule } from '../yookassa/yookassa.module';
import { SubscriptionTierModule } from '../subscription-tier/subscription-tier.module';
import { SUBSCRIPTION_REPOSITORY_PORT } from './constants';
import { DowngradeSubscriptionController } from './usecases/downgrade-subscription/downgrade-subscription.controller';
import { DowngradeSubscriptionUsecase } from './usecases/downgrade-subscription/downgrade-subscription.usecase';
import { SubscriptionStateService } from './domain/subscription.state';
import { SubscriptionService } from './services/subscription.service';
import { GiftModule } from '../gift/gift.module';
import { GetSubscriptionController } from './usecases/get-subscription/get-subscription.controller';
import { GetSubscriptionUsecase } from './usecases/get-subscription/get-subscription.usecase';

@Module({
	imports: [forwardRef(() => YookassaModule), SubscriptionTierModule, forwardRef(() => GiftModule)],
	controllers: [GetSubscriptionController, DowngradeSubscriptionController],
	providers: [
		GetSubscriptionUsecase,
		DowngradeSubscriptionUsecase,
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
