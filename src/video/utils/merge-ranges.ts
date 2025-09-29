import { UploadedRange } from '../video.entity';

export function mergeRanges(ranges: UploadedRange[]): { start: number; end: number }[] {
	if (!ranges.length) return [];
	const sortedNumericRanges = ranges.slice().sort((a, b) => a.start - b.start || a.end - b.end);
	const out: UploadedRange[] = [];
	let cur = { ...sortedNumericRanges[0] };
	for (let i = 1; i < sortedNumericRanges.length; i++) {
		const r = sortedNumericRanges[i];
		// склеиваем, если соприкасаются (end+1 == start) или перекрываются
		if (r.start <= cur.end + 1) {
			cur.end = Math.max(cur.end, r.end);
		} else {
			out.push(cur);
			cur = { ...r };
		}
	}
	out.push(cur);
	return out;
}
