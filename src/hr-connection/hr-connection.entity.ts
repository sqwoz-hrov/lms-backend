import { Insertable, Selectable, Updateable } from 'kysely';
import { Generated } from '../common/kysely-types/generated';
import { Timestamp } from '../common/kysely-types/timestamp';

export type HrConnectionStatus = 'waiting_us' | 'waiting_hr' | 'rejected' | 'offer';

export interface HrConnectionTable {
	id: Generated<string>;
	student_user_id: string;
	name: string;
	status: HrConnectionStatus;
	created_at: Generated<Timestamp>;
	chat_link: string;
}

export type HrConnection = Selectable<HrConnectionTable>;
export type NewHrConnection = Insertable<HrConnectionTable>;
export type HrConnectionUpdate = Updateable<HrConnectionTable>;

export interface HrConnectionAggregation {
	hr_connection: HrConnectionTable;
}
