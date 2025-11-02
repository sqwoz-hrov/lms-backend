import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubscriptionTierRepository } from '../../../subscription-tier/subscription-tier.repository';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { YOOKASSA_CLIENT } from '../../../yookassa/constants';
import { YookassaClientPort } from '../../../yookassa/services/yookassa-client.interface';
import { PaymentFormResponseDto } from '../../dto/create-payment-form.dto';

@Injectable()
export class CreatePaymentFormUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionTierRepository: SubscriptionTierRepository,
		@Inject(YOOKASSA_CLIENT) private readonly yookassaClient: YookassaClientPort,
	) {}

	async execute(params: {
		subscription_tier_id: string;
		user: UserWithSubscriptionTier;
	}): Promise<PaymentFormResponseDto> {
		const { subscription_tier_id, user } = params;

		const targetTier = await this.subscriptionTierRepository.findById(subscription_tier_id);

		if (!targetTier) {
			throw new NotFoundException('Subscription tier not found');
		}

		const payment = await this.yookassaClient.createPaymentForm({
			amountRubles: targetTier.price_rubles,
			description: `Оплата подписки (${targetTier.tier})`,
			metadata: {
				subscription_tier_id: targetTier.id,
				user_id: user.id,
			},
		});

		return PaymentFormResponseDto.fromYookassa(payment);
	}
}
