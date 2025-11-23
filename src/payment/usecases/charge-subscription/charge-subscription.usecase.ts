import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubscriptionTierRepository } from '../../../subscription-tier/subscription-tier.repository';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { YOOKASSA_CLIENT } from '../../../yookassa/constants';
import { YookassaClientPort } from '../../../yookassa/services/yookassa-client.interface';
import { ChargeSubscriptionResponseDto } from '../../dto/charge-subscription.dto';
import { SubscriptionRepository } from '../../../subscription/subscription.repository';

@Injectable()
export class ChargeSubscriptionUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionTierRepository: SubscriptionTierRepository,
		private readonly subscriptionRepository: SubscriptionRepository,
		@Inject(YOOKASSA_CLIENT) private readonly yookassaClient: YookassaClientPort,
	) {}

	async execute(params: {
		subscription_tier_id: string;
		user: UserWithSubscriptionTier;
	}): Promise<ChargeSubscriptionResponseDto> {
		const { subscription_tier_id, user } = params;

		const targetTier = await this.subscriptionTierRepository.findById(subscription_tier_id);

		if (!targetTier) {
			throw new NotFoundException('Subscription tier not found');
		}

		if (targetTier.price_rubles <= 0) {
			throw new BadRequestException('Subscription tier is not billable');
		}

		const currentTier = user.subscription_tier;
		if (targetTier.power < currentTier.power) {
			throw new BadRequestException(
				`Cannot downgrade subscription tier from "${currentTier.tier}" to "${targetTier.tier}"`,
			);
		}

		const paymentMethod = await this.subscriptionRepository.findPaymentMethodByUserId(user.id, undefined, {
			status: 'active',
		});

		if (!paymentMethod) {
			throw new NotFoundException('Payment method not found');
		}

		const payment = await this.yookassaClient.chargeSavedPaymentMethod({
			amountRubles: targetTier.price_rubles,
			description: `Оплата подписки (${targetTier.tier})`,
			paymentMethodId: paymentMethod.payment_method_id,
			metadata: {
				subscription_tier_id: targetTier.id,
				user_id: user.id,
			},
			idempotenceKey: `charge-subscription-${user.id}-${randomUUID()}`,
		});

		return ChargeSubscriptionResponseDto.fromYookassa(payment);
	}
}
