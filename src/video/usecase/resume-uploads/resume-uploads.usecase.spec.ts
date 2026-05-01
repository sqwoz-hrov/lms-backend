import { expect } from 'chai';
import { ResumeUploadsUsecase } from './resume-uploads.usecase';
import { Video } from '../../video.entity';

function makeVideo(overrides: Partial<Video>): Video {
	return {
		id: '9d3196da-ac74-4732-bd26-d08be11742fa',
		user_id: 'c79525d4-56d1-4fb8-8074-835b00fc3bc4',
		filename: 'video.mp4',
		mime_type: 'video/mp4',
		total_size: '10',
		chunk_size: '10',
		tmp_path: '/tmp/video.mp4',
		converted_tmp_path: null,
		phase: 'failed',
		uploaded_ranges: [],
		upload_offset: '0',
		checksum_sha256_base64: null,
		storage_key: null,
		transcription_audio_storage_key: null,
		workflow_retry_phase: null,
		workflow_retry_count: 0,
		workflow_last_error: null,
		workflow_last_error_at: null,
		upload_failed_phase: 'uploading_s3',
		upload_failed_reason: 'permanent',
		upload_failed_at: new Date(),
		created_at: new Date(),
		...overrides,
	};
}

describe('ResumeUploadsUsecase', () => {
	it('does not retry uploads already marked as failed on startup pass', async () => {
		const failedVideo = makeVideo({ phase: 'failed' });
		const findCalls: string[] = [];
		const advancedIds: string[] = [];

		const repo = {
			async find(filter: Partial<Video>) {
				const phase = String(filter.phase);
				findCalls.push(phase);
				if (phase === failedVideo.phase) {
					return [failedVideo];
				}
				return [];
			},
		};

		const runner = {
			async advance(videoId: string) {
				advancedIds.push(videoId);
			},
		};

		const usecase = new ResumeUploadsUsecase(repo as any, runner as any);
		await (usecase as any).resumeAllStuck();

		expect(findCalls).to.deep.equal(['converting', 'hashing', 'uploading_s3', 'receiving']);
		expect(advancedIds).to.deep.equal([]);
	});
});
