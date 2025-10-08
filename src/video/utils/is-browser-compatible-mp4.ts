import type { ProbeInfo } from './probe-video';

export function isBrowserCompatibleMp4(info: ProbeInfo): boolean {
	const isH264 = info.vcodec === 'h264';
	const is420 = !info.vpixfmt || info.vpixfmt === 'yuv420p';
	const levelOk = typeof info.vlevel !== 'number' || info.vlevel <= 42;
	const audioOk = !info.acodec || info.acodec === 'aac';

	return isH264 && is420 && levelOk && audioOk;
}
