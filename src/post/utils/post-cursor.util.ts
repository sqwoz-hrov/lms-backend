import { BadRequestException } from '@nestjs/common';

export type PostCursorPayload = {
	id: string;
	created_at: Date;
};

type RawPostCursorPayload = {
	id: string;
	created_at: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toRawPayload = (payload: PostCursorPayload): RawPostCursorPayload => ({
	id: payload.id,
	created_at: payload.created_at.toISOString(),
});

export const encodePostCursor = (payload: PostCursorPayload): string => {
	const rawPayload = JSON.stringify(toRawPayload(payload));
	return Buffer.from(rawPayload, 'utf8').toString('base64url');
};

export const decodePostCursor = (cursor: string): PostCursorPayload => {
	let parsed: unknown;

	try {
		const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
		parsed = JSON.parse(decoded);
	} catch {
		throw new BadRequestException('Invalid cursor format');
	}

	if (!parsed || typeof parsed !== 'object') {
		throw new BadRequestException('Invalid cursor payload');
	}

	const payload = parsed as Partial<RawPostCursorPayload>;

	if (!payload.id || typeof payload.id !== 'string' || !UUID_REGEX.test(payload.id)) {
		throw new BadRequestException('Invalid cursor payload: id must be a UUID');
	}

	if (!payload.created_at || typeof payload.created_at !== 'string') {
		throw new BadRequestException('Invalid cursor payload: created_at is required');
	}

	const createdAt = new Date(payload.created_at);
	if (Number.isNaN(createdAt.getTime())) {
		throw new BadRequestException('Invalid cursor payload: created_at is invalid');
	}

	return {
		id: payload.id,
		created_at: createdAt,
	};
};
