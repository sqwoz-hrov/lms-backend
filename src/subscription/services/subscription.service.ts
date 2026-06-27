import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionTier } from '../../subscription-tier/subscription-tier.entity';
import { User } from '../../user/user.entity';
import { NewSubscription, Subscription, SubscriptionDraft, SubscriptionState } from '../subscription.entity';
import { SubscriptionRepository, SubscriptionTransaction } from '../subscription.repository';
import { SubscriptionStateService } from '../domain/subscription.state';
import { UserSubscriptionTransaction } from '../../user/user.repository';

type DowngradeSubscriptionParams = {
	freeTier: SubscriptionTier;
	existingSubs: Subscription[];
	meta: {
		trx?: SubscriptionTransaction;
	}
}

interface RegistrationParams {
	user: Pick<User, 'id'>;
}

@Injectable()
export class SubscriptionService {
	private readonly logger = new Logger(SubscriptionService.name);

	constructor(private readonly subscriptionRepository: SubscriptionRepository, private readonly subscriptionStateService: SubscriptionStateService) {
	}

	public async handleRegistration<T extends UserSubscriptionTransaction>({ user }: RegistrationParams, trx: T): Promise<NewSubscription> {
		this.logger.debug(`Handling creating free tier-sub for user ${user.id}`);
		const freeTier = await this.subscriptionRepository.getFreeTier();
		const subscriptionsUserId: Pick<SubscriptionDraft, 'user_id'> = {
			user_id: user.id,
		};

        const freeTierBasicFields = this.subscriptionStateService.createFreeTierSubFields({}, freeTier)


		const sub = await this.subscriptionRepository.create({
            ...subscriptionsUserId,
            ...freeTierBasicFields,
        }, trx);
		this.logger.debug(`Created a free-tier sub with tier ${freeTier.id} for user ${user.id}`);

		return sub;
	}

	public async handleDowngradeToFreeTier({ freeTier, existingSubs, meta }: DowngradeSubscriptionParams): Promise<{downgradedCount: number}> {
		if (freeTier.power > 0) {
			throw new Error('Free tier power too high');
		}

        // we have to remember the last_billing_attempt, but that's set in the payment update anyways, so update will not touch this field
		const subUpdateData = this.subscriptionStateService.createFreeTierSubFields({}, freeTier);


		const { updated } = await this.subscriptionRepository.updateBatch(
			existingSubs.map(sub => sub.id),
			subUpdateData,
			meta.trx,
		);

		const downgradedCount = parseInt(updated);

		return { downgradedCount };
	}
}