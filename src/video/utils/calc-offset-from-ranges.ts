import { UploadedRange } from '../video.entity';
import { mergeRanges } from './merge-ranges';

export function calcOffsetFromRanges(ranges: UploadedRange[]): number {
	if (!ranges.length) return 0;
	// оффсет — длина непрерывного префикса, начинающегося с 0
	const merged = mergeRanges(ranges);
	if (merged[0].start !== 0) return 0;
	let end = merged[0].end;
	for (let i = 1; i < merged.length; i++) {
		const r = merged[i];
		if (r.start === end + 1) end = r.end;
		else break;
	}
	return end + 1;
}
