import { UploadedRange } from '../video.entity';

export function isRangeAlreadyCovered(ranges: UploadedRange[], s: number, e: number): boolean {
	return ranges.some(r => s >= r.start && e <= r.end);
}
