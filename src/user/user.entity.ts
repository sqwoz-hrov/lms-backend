import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export type UserRole = 'admin' | 'user';

export interface UserTable {
	id: Generated<string>;
	role: UserRole;
	name: string;
	email: string;
	telegram_id?: number;
	telegram_username: string;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export interface UserAggregation {
	user: UserTable;
}
