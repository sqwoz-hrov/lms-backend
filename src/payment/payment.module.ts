import { Module } from '@nestjs/common';
import { CreatePaymentFormController } from './usecases/create-payment-form/create-payment-form.controller';
import { CreatePaymentFormUsecase } from './usecases/create-payment-form/create-payment-form.usecase';
import { SubscriptionTierModule } from '../subscription-tier/subscription-tier.module';
import { AddPaymentMethodController } from './usecases/add-payment-method/add-payment-method.controller';
import { AddPaymentMethodUsecase } from './usecases/add-payment-method/add-payment-method.usecase';

@Module({
	imports: [SubscriptionTierModule],
	controllers: [CreatePaymentFormController, AddPaymentMethodController],
	providers: [CreatePaymentFormUsecase, AddPaymentMethodUsecase],
})
export class PaymentModule {}
