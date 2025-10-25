import { Injectable } from '@nestjs/common';
import {
	NewSubscription,
	Subscription,
	SubscriptionDraft,
	SubscriptionState,
	SubscriptionUpdate,
} from '../subscription.entity';
import { SubscriptionAction } from '../domain/subscription.manager';
import { SubscriptionRepository, SubscriptionTransaction } from '../subscription.repository';
import { Switch } from '../../common/utils/safe-guard';

@Injectable()
export class SubscriptionActionExecutor {
	constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

	async execute(params: {
		action: SubscriptionAction;
		trx: SubscriptionTransaction;
	}): Promise<Subscription | undefined> {
		const { action, trx } = params;

		switch (action.do) {
			case 'create':
				return this.subscriptionRepository.create(this.draftToNew(action.subscription), trx);
			case 'update_data':
			case 'prolong': {
				const subscriptionId = action.subscription.id;
				const updated = await this.subscriptionRepository.update(
					subscriptionId,
					this.stateToUpdate(action.subscription),
					trx,
				);
				if (!updated) {
					throw new Error(`Subscription ${subscriptionId} not found`);
				}
				return updated;
			}
			case 'delete': {
				const subscriptionId = action.subscription.id;
				if (subscriptionId) {
					await this.subscriptionRepository.deleteById(subscriptionId, trx);
				}
				return undefined;
			}
			default:
				return Switch.safeGuard(action);
		}
	}

	private draftToNew(draft: SubscriptionDraft): NewSubscription {
		const lastBillingAttempt = draft.last_billing_attempt ?? null;

		return {
			user_id: draft.user_id,
			subscription_tier_id: draft.subscription_tier_id,
			status: draft.status,
			price_on_purchase_rubles: draft.price_on_purchase_rubles,
			is_gifted: draft.is_gifted,
			grace_period_size: draft.grace_period_size,
			billing_period_days: draft.billing_period_days,
			current_period_end: draft.current_period_end,
			last_billing_attempt: lastBillingAttempt,
		};
	}

	private stateToUpdate(state: SubscriptionState): SubscriptionUpdate {
		const lastBillingAttempt = state.last_billing_attempt ?? null;

		return {
			user_id: state.user_id,
			subscription_tier_id: state.subscription_tier_id,
			status: state.status,
			price_on_purchase_rubles: state.price_on_purchase_rubles,
			is_gifted: state.is_gifted,
			grace_period_size: state.grace_period_size,
			billing_period_days: state.billing_period_days,
			current_period_end: state.current_period_end,
			last_billing_attempt: lastBillingAttempt,
		};
	}
}
