import { Module } from '@nestjs/common';
import { CreateSubscriptionTierController } from './usecases/create-subscription-tier/create-subscription-tier.controller';
import { DeleteSubscriptionTierController } from './usecases/delete-subscription-tier/delete-subscription-tier.controller';
import { GetSubscriptionTiersController } from './usecases/get-subscription-tiers/get-subscription-tiers.controller';
import { UpdateSubscriptionTierController } from './usecases/update-subscription-tier/update-subscription-tier.controller';
import { CreateSubscriptionTierUsecase } from './usecases/create-subscription-tier/create-subscription-tier.usecase';
import { DeleteSubscriptionTierUsecase } from './usecases/delete-subscription-tier/delete-subscription-tier.usecase';
import { GetSubscriptionTiersUsecase } from './usecases/get-subscription-tiers/get-subscription-tiers.usecase';
import { UpdateSubscriptionTierUsecase } from './usecases/update-subscription-tier/update-subscription-tier.usecase';
import { SubscriptionTierRepository } from './subscription-tier.repository';

@Module({
	controllers: [
		CreateSubscriptionTierController,
		DeleteSubscriptionTierController,
		GetSubscriptionTiersController,
		UpdateSubscriptionTierController,
	],
	providers: [
		CreateSubscriptionTierUsecase,
		DeleteSubscriptionTierUsecase,
		GetSubscriptionTiersUsecase,
		UpdateSubscriptionTierUsecase,
		SubscriptionTierRepository,
	],
	exports: [SubscriptionTierRepository],
})
export class SubscriptionTierModule {}
