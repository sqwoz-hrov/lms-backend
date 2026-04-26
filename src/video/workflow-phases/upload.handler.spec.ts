import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { UploadingS3Handler } from './upload.handler';
import { Video } from '../video.entity';

function makeVideo(overrides: Partial<Video>): Video {
	return {
		id: 'f8f5cc4f-b4d6-433b-aa2d-272b4b55bc5f',
		user_id: '67ed6fca-6f31-4fd5-b4d7-47c23adf12ca',
		filename: 'video.mp4',
		mime_type: 'video/mp4',
		total_size: '10',
		chunk_size: '10',
		tmp_path: '',
		converted_tmp_path: null,
		phase: 'uploading_s3',
		uploaded_ranges: [],
		upload_offset: '10',
		checksum_sha256_base64: null,
		storage_key: null,
		transcription_audio_storage_key: null,
		workflow_retry_phase: null,
		workflow_retry_count: 0,
		workflow_last_error: null,
		workflow_last_error_at: null,
		upload_failed_phase: null,
		upload_failed_reason: null,
		upload_failed_at: null,
		created_at: new Date(),
		...overrides,
	};
}

describe('UploadingS3Handler compensation', () => {
	it('cleans local files and deletes transcription audio only on terminal failure', async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-upload-handler-'));
		const tmpPath = path.join(tmpDir, 'source.mp4');
		const convertedPath = path.join(tmpDir, 'source.converted.mp4');
		const audioPath = path.join(tmpDir, 'source.transcription.wav');
		fs.writeFileSync(tmpPath, Buffer.from('source'));
		fs.writeFileSync(convertedPath, Buffer.from('converted'));
		fs.writeFileSync(audioPath, Buffer.from('audio'));

		let deleteAudioCalls = 0;
		const storage = {
			async deleteTranscriptionAudioByVideoId(_videoId: string) {
				deleteAudioCalls += 1;
			},
		};
		const transcoder = {
			buildTranscriptionAudioOutputPath(_inputPath: string) {
				return audioPath;
			},
		};

		const handler = new UploadingS3Handler({} as any, storage as any, transcoder as any);
		const video = makeVideo({
			tmp_path: tmpPath,
			converted_tmp_path: convertedPath,
		});

		await handler.compensate(video, new Error('non-terminal'), {
			phase: 'uploading_s3',
			retryCount: 1,
			retryLimit: 4,
			exhausted: false,
		});

		expect(deleteAudioCalls).to.equal(0);
		expect(fs.existsSync(tmpPath)).to.equal(true);
		expect(fs.existsSync(convertedPath)).to.equal(true);
		expect(fs.existsSync(audioPath)).to.equal(true);

		await handler.compensate(video, new Error('terminal'), {
			phase: 'uploading_s3',
			retryCount: 5,
			retryLimit: 4,
			exhausted: true,
		});

		expect(deleteAudioCalls).to.equal(1);
		expect(fs.existsSync(tmpPath)).to.equal(false);
		expect(fs.existsSync(convertedPath)).to.equal(false);
		expect(fs.existsSync(audioPath)).to.equal(false);

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});
});
