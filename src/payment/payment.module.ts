import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CreatePaymentFormController } from './usecases/create-payment-form/create-payment-form.controller';
import { CreatePaymentFormUsecase } from './usecases/create-payment-form/create-payment-form.usecase';

@Module({
	imports: [SubscriptionModule],
	controllers: [CreatePaymentFormController],
	providers: [CreatePaymentFormUsecase],
})
export class PaymentModule {}
