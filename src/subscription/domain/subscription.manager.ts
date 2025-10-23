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
	freeTierCode?: string;
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
	  }
	| {
			type: 'payment_method.active';
			paymentMethodId: string;
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
	existingSubscription?: SubscriptionState | null;
	now?: Date;
	gracePeriodSize?: number;
}

interface RegistrationParams {
	user: Pick<User, 'id'>;
	now?: Date;
}

export class SubscriptionManager {
	private readonly tierById = new Map<string, SubscriptionTier>();
	private readonly tierByCode = new Map<string, SubscriptionTier>();
	private readonly defaultBillingPeriodDays: number;
	private readonly defaultGracePeriodSize: number;
	private readonly freeTierCode: string;

	constructor(subscriptionTiers: SubscriptionTier[], options: SubscriptionManagerOptions = {}) {
		this.defaultBillingPeriodDays = options.defaultBillingPeriodDays ?? 30;
		this.defaultGracePeriodSize = options.defaultGracePeriodSize ?? 3;
		this.freeTierCode = options.freeTierCode ?? 'free';

		for (const tier of subscriptionTiers) {
			this.tierById.set(tier.id, tier);
			this.tierByCode.set(tier.tier, tier);
		}
	}

	handleRegistration(params: RegistrationParams): { action: SubscriptionAction } {
		const now = params.now ?? new Date();
		const freeTier = this.resolveFreeTier();

		const subscription: SubscriptionDraft = {
			user_id: params.user.id,
			subscription_tier_id: freeTier.id,
			status: 'active',
			price_on_purchase_rubles: 0,
			is_gifted: true,
			grace_period_size: this.defaultGracePeriodSize,
			billing_period_days: 0,
			payment_method_id: null,
			current_period_end: now,
			next_billing_at: null,
			billing_retry_attempts: 0,
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
				payment_method_id: null,
				current_period_end: currentPeriodEnd,
				next_billing_at: null,
				billing_retry_attempts: 0,
				last_billing_attempt: null,
			};

			return {
				action: { do: 'create', subscription },
			};
		}

		const existing = params.existingSubscription;
		const base = this.maxDate(existing.current_period_end, now);
		const nextEnd = this.addDays(base, periodDays);
		const updated: SubscriptionState = {
			...existing,
			subscription_tier_id: params.targetTier.id,
			status: 'active',
			is_gifted: true,
			price_on_purchase_rubles: 0,
			payment_method_id: null,
			billing_period_days: periodDays,
			current_period_end: nextEnd,
			next_billing_at: null,
			grace_period_size: grace,
			billing_retry_attempts: 0,
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
				next_billing_at: nextEnd,
				billing_retry_attempts: 0,
				last_billing_attempt: now,
			};

			return { action: { do: 'prolong', subscription: updated } };
		}

		const attempts = subscription.billing_retry_attempts + 1;
		const withinGrace = attempts < subscription.grace_period_size;

		if (withinGrace) {
			const updated: SubscriptionState = {
				...subscription,
				status: 'past_due',
				billing_retry_attempts: attempts,
				last_billing_attempt: now,
				next_billing_at: this.addDays(now, 1),
			};

			return {
				action: { do: 'update_data', subscription: updated },
			};
		}

		const canceled: SubscriptionState = {
			...subscription,
			status: 'canceled',
			billing_retry_attempts: attempts,
			last_billing_attempt: now,
			next_billing_at: null,
		};

		return { action: { do: 'delete', subscription: canceled } };
	}

	handlePaymentEvent(params: PaymentEventParams): { action: SubscriptionAction } {
		const now = params.now ?? new Date();
		const subscription = params.subscription;

		switch (params.event.type) {
			case 'payment_method.active': {
				if (subscription.payment_method_id === params.event.paymentMethodId) {
					return { action: { do: 'update_data', subscription } };
				}

				const updated: SubscriptionState = {
					...subscription,
					payment_method_id: params.event.paymentMethodId,
				};

				return { action: { do: 'update_data', subscription: updated } };
			}
			case 'payment.succeeded': {
				const occurredAt = params.event.occurredAt ?? now;
				const base = this.maxDate(subscription.current_period_end, occurredAt);
				const periodDays = this.normalizePeriodDays(subscription.billing_period_days || this.defaultBillingPeriodDays);
				const nextEnd = this.addDays(base, periodDays);

				const updated: SubscriptionState = {
					...subscription,
					status: 'active',
					current_period_end: nextEnd,
					next_billing_at: subscription.is_gifted ? null : nextEnd,
					billing_retry_attempts: 0,
					last_billing_attempt: occurredAt,
				};

				return { action: { do: 'prolong', subscription: updated } };
			}
			case 'payment.canceled': {
				const updated: SubscriptionState = {
					...subscription,
					status: 'canceled',
					next_billing_at: null,
					billing_retry_attempts: subscription.billing_retry_attempts,
					last_billing_attempt: params.event.occurredAt ?? now,
				};

				return { action: { do: 'delete', subscription: updated } };
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
		const freeTier = this.tierByCode.get(this.freeTierCode);
		if (!freeTier) {
			throw new Error(`Free subscription tier "${this.freeTierCode}" not configured`);
		}
		return freeTier;
	}

	private addDays(date: Date, days: number): Date {
		return new Date(date.getTime() + days * MS_IN_DAY);
	}

	private maxDate(left: Date, right: Date): Date {
		return left > right ? left : right;
	}
}
