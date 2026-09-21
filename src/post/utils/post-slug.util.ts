import { BadRequestException, ConflictException } from '@nestjs/common';

const RUSSIAN_TRANSLITERATION: Readonly<Record<string, string>> = {
	а: 'a',
	б: 'b',
	в: 'v',
	г: 'g',
	д: 'd',
	е: 'e',
	ё: 'yo',
	ж: 'zh',
	з: 'z',
	и: 'i',
	й: 'y',
	к: 'k',
	л: 'l',
	м: 'm',
	н: 'n',
	о: 'o',
	п: 'p',
	р: 'r',
	с: 's',
	т: 't',
	у: 'u',
	ф: 'f',
	х: 'kh',
	ц: 'ts',
	ч: 'ch',
	ш: 'sh',
	щ: 'shch',
	ъ: '',
	ы: 'y',
	ь: '',
	э: 'e',
	ю: 'yu',
	я: 'ya',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESERVED_SLUGS = new Set(['new']);

export const INVALID_POST_SLUG_MESSAGE = 'Невозможно создать постоянную ссылку из этого названия';
export const DUPLICATE_POST_SLUG_MESSAGE = 'Пост с такой постоянной ссылкой уже существует';

export function generatePostSlug(title: string): string {
	const transliterated = Array.from(
		title.toLowerCase(),
		character => RUSSIAN_TRANSLITERATION[character] ?? character,
	).join('');

	return transliterated
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-+/g, '-');
}

export function isValidPostSlug(slug: string): boolean {
	return slug.length > 0 && !RESERVED_SLUGS.has(slug) && !UUID_PATTERN.test(slug);
}

export function isUuid(value: string): boolean {
	return UUID_PATTERN.test(value);
}

export function generateValidPostSlug(title: string): string {
	const slug = generatePostSlug(title);

	if (!isValidPostSlug(slug)) {
		throw new BadRequestException(INVALID_POST_SLUG_MESSAGE);
	}

	return slug;
}

export function throwDuplicatePostSlug(): never {
	throw new ConflictException(DUPLICATE_POST_SLUG_MESSAGE);
}

export function isPostSlugUniqueViolation(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}

	const databaseError = error as { code?: string; constraint?: string };
	return databaseError.code === '23505' && databaseError.constraint === 'post_slug_unique';
}
