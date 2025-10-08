export type HwAccel = 'nvenc' | 'qsv' | 'vaapi' | 'none';

export function parseHwAccel(env: string | undefined): HwAccel {
	if (env === 'nvenc' || env === 'qsv' || env === 'vaapi') return env;
	return 'none';
}

export function pickVideoEncoder(hw: HwAccel): { vcodec: string; extra: string[] } {
	switch (hw) {
		case 'nvenc':
			return { vcodec: 'h264_nvenc', extra: ['-rc:v', 'vbr', '-cq', '23'] };
		case 'qsv':
			return { vcodec: 'h264_qsv', extra: [] };
		case 'vaapi':
			return {
				vcodec: 'h264_vaapi',
				extra: ['-vaapi_device', '/dev/dri/renderD128', '-vf', 'format=nv12,hwupload'],
			};
		case 'none':
		default:
			return { vcodec: 'libx264', extra: [] };
	}
}
