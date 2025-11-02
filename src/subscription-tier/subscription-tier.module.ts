import { Module } from '@nestjs/common';
import { CreateSubscriptionTierController } from './usecases/create-subscription-tier/create-subscription-tier.controller';
import { DeleteSubscriptionTierController } from './usecases/delete-subscription-tier/delete-subscription-tier.controller';
import { GetSubscriptionTiersController } from './usecases/get-subscription-tiers/get-subscription-tiers.controller';
import { CreateSubscriptionTierUsecase } from './usecases/create-subscription-tier/create-subscription-tier.usecase';
import { DeleteSubscriptionTierUsecase } from './usecases/delete-subscription-tier/delete-subscription-tier.usecase';
import { GetSubscriptionTiersUsecase } from './usecases/get-subscription-tiers/get-subscription-tiers.usecase';
import { SubscriptionTierRepository } from './subscription-tier.repository';

@Module({
	controllers: [CreateSubscriptionTierController, DeleteSubscriptionTierController, GetSubscriptionTiersController],
	providers: [
		CreateSubscriptionTierUsecase,
		DeleteSubscriptionTierUsecase,
		GetSubscriptionTiersUsecase,
		SubscriptionTierRepository,
	],
	exports: [SubscriptionTierRepository],
})
export class SubscriptionTierModule {}
