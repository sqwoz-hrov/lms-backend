import { forwardRef, Module } from '@nestjs/common';
import { SubscriptionTierModule } from '../subscription-tier/subscription-tier.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { UserModule } from '../user/user.module';
import { GiftSubscriptionController } from './usecases/gift-subscription/gift-subscription.controller';
import { AcceptGiftedSubscriptionUsecase } from './usecases/accept-gifted-subscription/accept-gifted-subscription.usecase';
import { AcceptGiftedSubscriptionController } from './usecases/accept-gifted-subscription/accept-gifted-subscription.controller';
import { GiftSubscriptionUsecase } from './usecases/gift-subscription/gift-subscription.usecase';
import { GiftRepository } from './gift.repository';

@Module({
    imports: [
        SubscriptionTierModule,
        forwardRef(() => SubscriptionModule),
        forwardRef(() => UserModule),
    ],
    providers: [
        GiftSubscriptionUsecase,
        AcceptGiftedSubscriptionUsecase,
        GiftRepository,
    ],
    controllers: [
        GiftSubscriptionController,
        AcceptGiftedSubscriptionController,
    ],
    exports: [GiftRepository],
})
export class GiftModule {}
