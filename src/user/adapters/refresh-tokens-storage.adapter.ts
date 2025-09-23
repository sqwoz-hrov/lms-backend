import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';

import { jwtConfig } from '../../config';
import { REDIS_CONNECTION_KEY } from '../../infra/redis.const';
import { IRefreshTokenStorage, RefreshTokenRecord } from '../ports/refresh-token-storage.port';
import { createHmac } from 'crypto';

export const rtKey = (jti: string) => `rt:${jti}`;
export const userIndexKey = (userId: string) => `user:${userId}:rt`;

@Injectable()
export class RefreshTokenRedisStorage implements IRefreshTokenStorage {
	constructor(
		@Inject(REDIS_CONNECTION_KEY) private readonly redis: Redis,
		@Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
	) {}

	hash(rawToken: string): string {
		const secret = this.config.refreshSecret;
		return createHmac('sha256', secret).update(rawToken).digest('hex');
	}

	async save(rec: RefreshTokenRecord): Promise<void> {
		const key = rtKey(rec.jti);
		const ttlSec = this.computeTtlSeconds(rec.expiresAt);

		// Запись как HASH
		const hmsetArgs: Record<string, string | number> = {
			jti: rec.jti,
			userId: rec.userId,
			tokenHash: rec.tokenHash,
			createdAt: rec.createdAt,
			expiresAt: rec.expiresAt,
		};
		if (rec.familyId) hmsetArgs.familyId = rec.familyId;
		if (rec.ip) hmsetArgs.ip = rec.ip;
		if (rec.userAgent) hmsetArgs.userAgent = rec.userAgent;

		await this.redis
			.multi()
			.hset(key, hmsetArgs as any)
			.expire(key, ttlSec)
			.sadd(userIndexKey(rec.userId), rec.jti)
			.pexpire(userIndexKey(rec.userId), Math.max(ttlSec * 1000, 3600_000))
			.exec();
	}

	async getByJti(jti: string): Promise<RefreshTokenRecord | undefined> {
		const key = rtKey(jti);
		const data = await this.redis.hgetall(key);
		if (!data || Object.keys(data).length === 0) return undefined;

		return {
			jti: data.jti,
			userId: data.userId,
			tokenHash: data.tokenHash,
			familyId: data.familyId,
			createdAt: Number(data.createdAt),
			expiresAt: Number(data.expiresAt),
			ip: data.ip,
			userAgent: data.userAgent,
		};
	}

	async exists(jti: string): Promise<boolean> {
		const key = rtKey(jti);
		const res = await this.redis.exists(key);
		return res === 1;
	}

	async revokeByJti(jti: string): Promise<void> {
		const key = rtKey(jti);
		// Чтобы удалить из индекса — сначала узнаем userId
		const userId = await this.redis.hget(key, 'userId');
		const m = this.redis.multi().del(key);
		if (userId) m.srem(userIndexKey(userId), jti);
		await m.exec();
	}

	async revokeAllForUser(userId: string): Promise<void> {
		const idx = userIndexKey(userId);
		// Получаем все jti и удаляем пачкой
		const allJti = await this.redis.smembers(idx);
		if (allJti.length === 0) {
			// всё равно пытаемся подчистить индекс — пусть истечёт сам
			await this.redis.expire(idx, 60);
			return;
		}

		const m = this.redis.multi();
		for (const jti of allJti) {
			m.del(rtKey(jti));
			m.srem(idx, jti);
		}
		// пусть индекс живёт коротко, если вдруг что-то осталось
		m.expire(idx, 60);
		await m.exec();
	}

	/**
	 * Атомарная ротация: удалить старый jti (если был) и записать новый.
	 * Не делаем сложной логики «reuse detection» здесь — это лучше решать в домене.
	 */
	async rotate(oldJti: string | undefined, next: RefreshTokenRecord): Promise<void> {
		const nextKey = rtKey(next.jti);
		const ttlSec = this.computeTtlSeconds(next.expiresAt);

		const hmsetArgs: Record<string, string | number> = {
			jti: next.jti,
			userId: next.userId,
			tokenHash: next.tokenHash,
			createdAt: next.createdAt,
			expiresAt: next.expiresAt,
		};
		if (next.familyId) hmsetArgs.familyId = next.familyId;
		if (next.ip) hmsetArgs.ip = next.ip;
		if (next.userAgent) hmsetArgs.userAgent = next.userAgent;

		const m = this.redis.multi();
		if (oldJti) {
			const oldKey = rtKey(oldJti);
			// перед удалением попробуем вытащить userId старого токена — если он совпадает, зачистим индекс
			m.hget(oldKey, 'userId');
			m.del(oldKey);
		}

		// запись нового
		m.hset(nextKey, hmsetArgs as any);
		m.expire(nextKey, ttlSec);
		m.sadd(userIndexKey(next.userId), next.jti);
		m.pexpire(userIndexKey(next.userId), Math.max(ttlSec * 1000, 3600_000));

		const res = await m.exec();

		// Если был oldJti — попытка удалить из индекса (дешёвая доп. операция вне транзакции)
		if (oldJti && res && res.length >= 2) {
			// первый hget в транзакции
			const oldUserId = res[0][1] as string | null;
			if (oldUserId) {
				await this.redis.srem(userIndexKey(oldUserId), oldJti);
			}
		}
	}

	private computeTtlSeconds(expiresAtMs: number): number {
		const nowMs = Date.now();
		const diff = Math.floor((expiresAtMs - nowMs) / 1000);
		if (diff > 0) return diff;
		// fallback на конфиг, если exp уже в прошлом (на всякий случай)
		return Math.max(1, this.config.refreshExpiresInSeconds ?? 7 * 24 * 3600);
	}
}
