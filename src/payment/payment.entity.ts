import { Generated } from '../common/kysely-types/generated';
import { Timestamp } from '../common/kysely-types/timestamp';
import { ColumnType, Selectable, Insertable, Updateable } from 'kysely';

export type PaymentMethodStatus = 'pending' | 'active';

export interface PaymentMethodTable {
	id: Generated<string>;
	user_id: string;
	payment_method_id: string;
	status: ColumnType<PaymentMethodStatus, PaymentMethodStatus | undefined, PaymentMethodStatus | undefined>;
	created_at: Generated<Timestamp>;
	updated_at: Generated<Timestamp>;
}

export type PaymentMethod = Selectable<PaymentMethodTable>;
export type NewPaymentMethod = Insertable<PaymentMethodTable>;
export type PaymentMethodUpdate = Updateable<PaymentMethodTable>;

export interface PaymentEventTable {
	id: Generated<string>;
	user_id: ColumnType<string | null, string | null | undefined>;
	subscription_id: ColumnType<string | null, string | null | undefined>;
	event: ColumnType<unknown, unknown>;
	created_at: Generated<Timestamp>;
}

export type PaymentEvent = Selectable<PaymentEventTable>;
export type NewPaymentEvent = Insertable<PaymentEventTable>;

export type PaymentDatabase = {
	payment_method: PaymentMethodTable;
	payment_event: PaymentEventTable;
};
