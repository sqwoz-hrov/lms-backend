export type RefreshTokenRecord = {
	jti: string;
	userId: string;
	tokenHash: string;
	familyId?: string;
	createdAt: number;
	expiresAt: number;
	ip?: string;
	userAgent?: string;
};

export interface IRefreshTokenStorage {
	save(rec: RefreshTokenRecord): Promise<void>;
	getByJti(jti: string): Promise<RefreshTokenRecord | undefined>;
	exists(jti: string): Promise<boolean>;
	revokeByJti(jti: string): Promise<void>;
	revokeAllForUser(userId: string): Promise<void>;
	rotate(oldJti: string | undefined, next: RefreshTokenRecord): Promise<void>;
	hash(rawToken: string): string;
}
