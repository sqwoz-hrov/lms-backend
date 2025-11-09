export const SUBSCRIPTION_REPOSITORY_PORT = Symbol('SUBSCRIPTION_REPOSITORY_PORT');

export const MS_IN_DAY = 24 * 60 * 60 * 1000;

export enum BillingEventType {
	ATTEMPT_PREPARED = 'billing.attempt-prepared',
	CHARGE_REQUESTED = 'billing.charge-requested',
	CHARGE_REQUEST_FAILED = 'billing.charge-request-failed',
}
