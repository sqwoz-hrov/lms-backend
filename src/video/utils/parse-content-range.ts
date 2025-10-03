// src/video/utils/parse-content-range.ts

/**
 * Парсит заголовок Content-Range вида: "bytes start-end/total".
 * Возвращает { start, end, total } или null.
 */
export function parseContentRange(h: string | undefined): { start: number; end: number; total: number } | null {
	if (!h) return null;
	const m = /^bytes\s+(\d+)-(\d+)\/(\d+)$/.exec(h.trim());
	if (!m) return null;
	const start = Number(m[1]);
	const end = Number(m[2]);
	const total = Number(m[3]);
	if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(total)) return null;
	if (!(end >= start) || !(total > end)) return null;
	return { start, end, total };
}
