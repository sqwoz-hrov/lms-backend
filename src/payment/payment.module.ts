import { Module } from '@nestjs/common';
import { ChargeSubscriptionController } from './usecases/charge-subscription/charge-subscription.controller';
import { ChargeSubscriptionUsecase } from './usecases/charge-subscription/charge-subscription.usecase';
import { SubscriptionTierModule } from '../subscription-tier/subscription-tier.module';
import { AddPaymentMethodController } from './usecases/add-payment-method/add-payment-method.controller';
import { AddPaymentMethodUsecase } from './usecases/add-payment-method/add-payment-method.usecase';
import { DeletePaymentMethodController } from './usecases/delete-payment-method/delete-payment-method.controller';
import { DeletePaymentMethodUsecase } from './usecases/delete-payment-method/delete-payment-method.usecase';
import { GetActivePaymentMethodController } from './usecases/get-active-payment-method/get-active-payment-method.controller';
import { GetActivePaymentMethodUsecase } from './usecases/get-active-payment-method/get-active-payment-method.usecase';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
	imports: [SubscriptionTierModule, SubscriptionModule],
	controllers: [
		ChargeSubscriptionController,
		AddPaymentMethodController,
		DeletePaymentMethodController,
		GetActivePaymentMethodController,
	],
	providers: [
		ChargeSubscriptionUsecase,
		AddPaymentMethodUsecase,
		DeletePaymentMethodUsecase,
		GetActivePaymentMethodUsecase,
	],
})
export class PaymentModule {}
