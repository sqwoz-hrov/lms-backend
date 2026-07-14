import { Injectable, Inject, Logger } from '@nestjs/common';
import { SubscriptionTier } from '../../subscription-tier/subscription-tier.entity';
import { User } from '../../user/user.entity';
import { MS_IN_DAY } from '../constants';
import { SubscriptionState } from '../subscription.entity';
import {
	PaymentWebhookEvent,
	YookassaPaymentCanceledWebhook,
	YookassaPaymentSucceededWebhook,
} from '../types/yookassa-webhook';
import { ConfigType } from '@nestjs/config';
import { subscriptionConfig } from '../../config/subscription.config';
import { PaidAndGiftedSubPerUserView } from '../subscription.repository';
import { GiftState } from '../../gift/gift.entity';
import { parseAmount } from '../../payment/payment.utils';

interface PaymentEventParams {
	user: Pick<User, 'id'>;
	freeTier: SubscriptionTier;
	subscription: PaidAndGiftedSubPerUserView;
	event: PaymentWebhookEvent & {
		meta: {
			targetTierPower: SubscriptionTier['power'];
			paidAmount: (YookassaPaymentCanceledWebhook | YookassaPaymentSucceededWebhook)['object']['amount'];
		};
	};
}

@Injectable()
export class SubscriptionStateService {
	private readonly defaultBillingPeriodDays: number;
	private readonly defaultGracePeriodSize: number;
	private readonly logger = new Logger(SubscriptionStateService.name);

	constructor(@Inject(subscriptionConfig.KEY) private readonly config: ConfigType<typeof subscriptionConfig>) {
		this.defaultBillingPeriodDays = this.config.defaultBillingPeriodDays ?? 30;
		this.defaultGracePeriodSize = this.config.defaultGracePeriodSize ?? 3;
	}

	public handlePaymentEvent(params: PaymentEventParams): { newSub: SubscriptionState; newGift: GiftState | undefined } {
		const { subscription, event, freeTier } = params;
		const { currentActiveGiftSubscription, currentPaidSubscription } = subscription;

		switch (event.type) {
			case 'payment.succeeded': {
				const occurredAt = event.occurredAt;
				const base = this.maxDate(currentPaidSubscription.subscription.current_period_end, occurredAt);
				const periodDays = this.normalizePeriodDays(
					currentPaidSubscription.subscription.billing_period_days || this.defaultBillingPeriodDays,
				);

				const giftedSubDays = this.normalizeGiftDays(currentActiveGiftSubscription?.gift.giftedDaysLeft);
				const giftedSubPower = currentActiveGiftSubscription?.currentTier.giftedTierPower ?? 0;

				const targetTierId = event.meta.current_tier_id;
				const targetTierPower = event.meta.targetTierPower;

				// move days, all good
				if (giftedSubPower > targetTierPower) {
					const nextEnd = this.addDays(this.addDays(base, periodDays), giftedSubDays);

					const updated: SubscriptionState = {
						...currentPaidSubscription.subscription,
						price_on_purchase_rubles: parseAmount(event.meta.paidAmount.value),
						grace_period_size: this.defaultGracePeriodSize,
						current_period_end: nextEnd,
						last_billing_attempt: occurredAt,
					};

					if (targetTierId !== currentPaidSubscription.subscription.current_tier_id) {
						const switched: SubscriptionState = {
							...updated,
							price_on_purchase_rubles: parseAmount(event.meta.paidAmount.value),
							current_tier_id: targetTierId,
							next_tier_id: targetTierId,
						};

						return { newSub: switched, newGift: undefined };
					}

					return { newSub: updated, newGift: undefined };

					// stash away the gift with leftover days when he buys a higher/equal tier sub
					// wrap up the unused part of the gift to go
				} else {
					const nextEnd = this.addDays(base, periodDays);
					const newGift: GiftState = {
						activated_at: null,
						duration_days: giftedSubDays,
					};

					const updated: SubscriptionState = {
						...currentPaidSubscription.subscription,
						grace_period_size: this.defaultGracePeriodSize,
						current_period_end: nextEnd,
						last_billing_attempt: occurredAt,
						price_on_purchase_rubles: parseAmount(event.meta.paidAmount.value),
					};

					if (targetTierId !== currentPaidSubscription.subscription.current_tier_id) {
						const switched: SubscriptionState = {
							...updated,
							current_tier_id: targetTierId,
							next_tier_id: targetTierId,
							price_on_purchase_rubles: parseAmount(event.meta.paidAmount.value),
						};

						return { newSub: switched, newGift };
					}

					return { newSub: updated, newGift };
				}
			}
			case 'payment.canceled': {
				const occurredAt = params.event.occurredAt;
				const withinGrace = this.isWithinGracePeriod(currentPaidSubscription.subscription, occurredAt);

				if (!withinGrace) {
					const downgraded = this.createFreeTierSubFields(
						{
							...currentPaidSubscription.subscription,
							last_billing_attempt: occurredAt,
						},
						freeTier,
					);
					return { newSub: downgraded, newGift: undefined };
				}

				const updated: SubscriptionState = {
					...currentPaidSubscription.subscription,
					last_billing_attempt: occurredAt,
				};

				return { newSub: updated, newGift: undefined };
			}
		}
	}

	public createFreeTierSubFields(
		subscription: Record<string, never>,
		freeTier: SubscriptionTier,
	): Omit<SubscriptionState, 'id' | 'last_billing_attempt' | 'user_id'>;
	public createFreeTierSubFields(
		subscription: Pick<SubscriptionState, 'user_id' | 'id' | 'last_billing_attempt'>,
		freeTier: SubscriptionTier,
	): SubscriptionState;
	public createFreeTierSubFields(
		subscription:
			| (Pick<SubscriptionState, 'user_id'> & Pick<SubscriptionState, 'last_billing_attempt' | 'id'>)
			| Record<string, never>,
		freeTier: SubscriptionTier,
	): SubscriptionState | Omit<SubscriptionState, 'id' | 'last_billing_attempt' | 'user_id'> {
		if (subscription.id) {
			return {
				...subscription,
				current_tier_id: freeTier.id,
				next_tier_id: freeTier.id,
				price_on_purchase_rubles: 0,
				grace_period_size: 0,
				billing_period_days: 0,
				current_period_end: null,
				last_billing_attempt: subscription.last_billing_attempt,
			};
		}

		return {
			current_tier_id: freeTier.id,
			next_tier_id: freeTier.id,
			price_on_purchase_rubles: 0,
			grace_period_size: 0,
			billing_period_days: 0,
			current_period_end: null,
		};
	}

	private normalizePeriodDays(candidate: number | undefined): number {
		if (!candidate || Number.isNaN(candidate) || candidate <= 0) {
			return this.defaultBillingPeriodDays;
		}

		return Math.trunc(candidate);
	}

	private normalizeGiftDays(candidate: number | undefined): number {
		if (!candidate || Number.isNaN(candidate) || candidate <= 0) {
			return 0;
		}

		return Math.trunc(candidate);
	}

	private addDays(date: Date, days: number): Date {
		if (days === 0) {
			return date;
		}

		return new Date(date.getTime() + days * MS_IN_DAY);
	}

	private maxDate(left: Date | null, right: Date): Date {
		if (!left) {
			return right;
		}
		return left > right ? left : right;
	}

	private isWithinGracePeriod(subscription: SubscriptionState, comparison: Date): boolean {
		const gracePeriodDays = subscription.grace_period_size ?? this.defaultGracePeriodSize;
		if (!subscription.current_period_end) {
			return false;
		}
		const graceEnd = this.addDays(subscription.current_period_end, Math.max(0, gracePeriodDays));
		return comparison.getTime() <= graceEnd.getTime();
	}
}
