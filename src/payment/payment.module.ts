import { Module } from '@nestjs/common';
import { CreatePaymentFormController } from './usecases/create-payment-form/create-payment-form.controller';
import { CreatePaymentFormUsecase } from './usecases/create-payment-form/create-payment-form.usecase';
import { SubscriptionTierModule } from '../subscription-tier/subscription-tier.module';

@Module({
	imports: [SubscriptionTierModule],
	controllers: [CreatePaymentFormController],
	providers: [CreatePaymentFormUsecase],
})
export class PaymentModule {}
