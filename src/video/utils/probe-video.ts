import * as ffmpeg from 'fluent-ffmpeg';

export type ProbeInfo = {
	vcodec?: string;
	vprofile?: string | number;
	vlevel?: number;
	vpixfmt?: string;
	acodec?: string;
};

export async function probeVideo(inputPath: string): Promise<ProbeInfo> {
	return new Promise<ProbeInfo>((resolve, reject) => {
		ffmpeg.ffprobe(inputPath, (err: Error, data) => {
			if (err) {
				return reject(err);
			}

			const v = data.streams.find(s => s.codec_type === 'video');
			const a = data.streams.find(s => s.codec_type === 'audio');

			resolve({
				vcodec: v?.codec_name,
				vprofile: typeof v?.profile === 'number' || typeof v?.profile === 'string' ? v.profile : undefined,
				vlevel: typeof v?.level === 'number' ? v.level : undefined,
				vpixfmt: v?.pix_fmt,
				acodec: a?.codec_name,
			});
		});
	});
}
