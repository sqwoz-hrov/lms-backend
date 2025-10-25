import { SubscriptionTier, User } from '../../user/user.entity';
import { SubscriptionDraft, SubscriptionState } from '../subscription.entity';

const MS_IN_DAY = 24 * 60 * 60 * 1000;

export type SubscriptionActionType = 'create' | 'delete' | 'update_data' | 'prolong';

export type SubscriptionAction =
	| { do: 'create'; subscription: SubscriptionDraft }
	| { do: 'delete'; subscription: SubscriptionState }
	| { do: 'update_data'; subscription: SubscriptionState }
	| { do: 'prolong'; subscription: SubscriptionState };

interface SubscriptionManagerOptions {
	defaultBillingPeriodDays?: number;
	defaultGracePeriodSize?: number;
}

interface BillingCronParams {
	user: Pick<User, 'id'>;
	subscription: SubscriptionState;
	outcome: 'success' | 'failure';
	now?: Date;
}

type PaymentWebhookEvent =
	| {
			type: 'payment.succeeded';
			occurredAt?: Date;
	  }
	| {
			type: 'payment.canceled';
			occurredAt?: Date;
	  };

interface PaymentEventParams {
	user: Pick<User, 'id'>;
	subscription: SubscriptionState;
	event: PaymentWebhookEvent;
	now?: Date;
}

interface GiftSubscriptionParams {
	user: Pick<User, 'id'>;
	targetTier: SubscriptionTier;
	durationDays: number;
	existingSubscription?: SubscriptionState;
	now?: Date;
	gracePeriodSize?: number;
}

interface RegistrationParams {
	user: Pick<User, 'id'>;
	now?: Date;
}

export class SubscriptionManager {
	private readonly tierById = new Map<string, SubscriptionTier>();
	private readonly tierByPower = new Map<number, SubscriptionTier>();
	private readonly defaultBillingPeriodDays: number;
	private readonly defaultGracePeriodSize: number;

	constructor(subscriptionTiers: SubscriptionTier[], options: SubscriptionManagerOptions = {}) {
		this.defaultBillingPeriodDays = options.defaultBillingPeriodDays ?? 30;
		this.defaultGracePeriodSize = options.defaultGracePeriodSize ?? 3;

		for (const tier of subscriptionTiers) {
			this.tierById.set(tier.id, tier);
			if (this.tierByPower.has(tier.power)) {
				throw new Error(`Duplicate subscription tier power "${tier.power}" configured`);
			}
			this.tierByPower.set(tier.power, tier);
		}
	}

	handleRegistration(params: RegistrationParams): { action: SubscriptionAction } {
		const freeTier = this.resolveFreeTier();

		const subscription: SubscriptionDraft = {
			user_id: params.user.id,
			subscription_tier_id: freeTier.id,
			status: 'active',
			price_on_purchase_rubles: 0,
			is_gifted: true,
			grace_period_size: this.defaultGracePeriodSize,
			billing_period_days: 0,
			current_period_end: null,
			last_billing_attempt: null,
		};
		return {
			action: { do: 'create', subscription },
		};
	}

	handleGift(params: GiftSubscriptionParams): { action: SubscriptionAction } {
		const now = params.now ?? new Date();
		const periodDays = this.normalizePeriodDays(params.durationDays);
		const grace =
			params.gracePeriodSize ?? params.existingSubscription?.grace_period_size ?? this.defaultGracePeriodSize;

		if (!params.existingSubscription) {
			const currentPeriodEnd = this.addDays(now, periodDays);
			const subscription: SubscriptionDraft = {
				user_id: params.user.id,
				subscription_tier_id: params.targetTier.id,
				status: 'active',
				price_on_purchase_rubles: 0,
				is_gifted: true,
				grace_period_size: grace,
				billing_period_days: periodDays,
				current_period_end: currentPeriodEnd,
				last_billing_attempt: null,
			};

			return {
				action: { do: 'create', subscription },
			};
		}

		const existing = params.existingSubscription;
		const existingTier = this.tierById.get(existing.subscription_tier_id);

		if (!existingTier) {
			throw new Error(`Unknown subscription tier "${existing.subscription_tier_id}"`);
		}

		if (existingTier.power > params.targetTier.power) {
			throw new Error(`Cannot downgrade subscription tier from "${existingTier.tier}" to "${params.targetTier.tier}"`);
		}

		const base = this.maxDate(existing.current_period_end, now);
		const nextEnd = this.addDays(base, periodDays);
		const updated: SubscriptionState = {
			...existing,
			subscription_tier_id: params.targetTier.id,
			status: 'active',
			is_gifted: true,
			price_on_purchase_rubles: 0,
			current_period_end: nextEnd,
			grace_period_size: grace,
			last_billing_attempt: null,
		};

		const doAction: SubscriptionActionType =
			existing.is_gifted && existing.subscription_tier_id === params.targetTier.id ? 'prolong' : 'update_data';

		return { action: { do: doAction, subscription: updated } };
	}

	handleBillingCron(params: BillingCronParams): { action: SubscriptionAction } {
		const now = params.now ?? new Date();
		const subscription = params.subscription;

		if (params.outcome === 'success') {
			const base = this.maxDate(subscription.current_period_end, now);
			const periodDays = this.normalizePeriodDays(subscription.billing_period_days || this.defaultBillingPeriodDays);
			const nextEnd = this.addDays(base, periodDays);

			const updated: SubscriptionState = {
				...subscription,
				status: 'active',
				current_period_end: nextEnd,
				last_billing_attempt: now,
			};

			return { action: { do: 'prolong', subscription: updated } };
		}

		const withinGrace = this.isWithinGracePeriod(subscription, now);

		if (withinGrace) {
			const updated: SubscriptionState = {
				...subscription,
				last_billing_attempt: now,
			};

			return {
				action: { do: 'update_data', subscription: updated },
			};
		}

		const downgraded = this.downgradeToFreeTier(subscription, now);

		return { action: { do: 'update_data', subscription: downgraded } };
	}

	handlePaymentEvent(params: PaymentEventParams): { action: SubscriptionAction } {
		const now = params.now ?? new Date();
		const subscription = params.subscription;

		switch (params.event.type) {
			case 'payment.succeeded': {
				const occurredAt = params.event.occurredAt ?? now;
				const base = this.maxDate(subscription.current_period_end, occurredAt);
				const periodDays = this.normalizePeriodDays(subscription.billing_period_days || this.defaultBillingPeriodDays);
				const nextEnd = this.addDays(base, periodDays);

				const updated: SubscriptionState = {
					...subscription,
					status: 'active',
					current_period_end: nextEnd,
					last_billing_attempt: occurredAt,
				};

				return { action: { do: 'prolong', subscription: updated } };
			}
			case 'payment.canceled': {
				const occurredAt = params.event.occurredAt ?? now;
				const withinGrace = this.isWithinGracePeriod(subscription, occurredAt);

				if (!withinGrace) {
					const downgraded = this.downgradeToFreeTier(subscription, occurredAt);
					return { action: { do: 'update_data', subscription: downgraded } };
				}

				const updated: SubscriptionState = {
					...subscription,
					last_billing_attempt: occurredAt,
				};

				return { action: { do: 'update_data', subscription: updated } };
			}
		}
	}

	private normalizePeriodDays(candidate: number | undefined): number {
		if (!candidate || Number.isNaN(candidate) || candidate <= 0) {
			return this.defaultBillingPeriodDays;
		}

		return Math.trunc(candidate);
	}

	private resolveFreeTier(): SubscriptionTier {
		const freeTier = this.tierByPower.get(0);
		if (!freeTier) {
			throw new Error('Free subscription tier with power 0 not configured');
		}
		return freeTier;
	}

	private addDays(date: Date, days: number): Date {
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

	private downgradeToFreeTier(subscription: SubscriptionState, occurredAt: Date): SubscriptionState {
		const freeTier = this.resolveFreeTier();
		return {
			...subscription,
			subscription_tier_id: freeTier.id,
			status: 'active',
			price_on_purchase_rubles: 0,
			is_gifted: true,
			grace_period_size: this.defaultGracePeriodSize,
			billing_period_days: 0,
			current_period_end: null,
			last_billing_attempt: occurredAt,
		};
	}
}
