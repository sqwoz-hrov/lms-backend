import { UploadedRange } from '../video.entity';

export function hasConflictingOverlap(ranges: UploadedRange[], s: number, e: number): boolean {
	// конфликт — частичное перекрытие (не «полностью внутри», и не «впритык»)
	return ranges.some(r => {
		const disjoint = e < r.start || s > r.end;
		const inside = s >= r.start && e <= r.end;
		const touching = e + 1 === r.start || s === r.end + 1;
		return !(disjoint || inside || touching);
	});
}
