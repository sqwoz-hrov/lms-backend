import { Module } from '@nestjs/common';
import { CreatePaymentFormController } from './usecases/create-payment-form/create-payment-form.controller';
import { CreatePaymentFormUsecase } from './usecases/create-payment-form/create-payment-form.usecase';
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
		CreatePaymentFormController,
		AddPaymentMethodController,
		DeletePaymentMethodController,
		GetActivePaymentMethodController,
	],
	providers: [
		CreatePaymentFormUsecase,
		AddPaymentMethodUsecase,
		DeletePaymentMethodUsecase,
		GetActivePaymentMethodUsecase,
	],
})
export class PaymentModule {}
