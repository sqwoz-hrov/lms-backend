import { expect } from 'chai';
import { WorkflowRunnerService } from './workflow-runner.service';
import { UploadPhase, Video } from '../video.entity';
import { VideoUploadWorkflowPolicyService } from './video-upload-workflow-policy.service';

type MutableVideo = Video & {
	workflow_retry_count: number;
};

function makeVideo(overrides: Partial<Video> = {}): MutableVideo {
	return {
		id: '8a1f8b3a-79cb-4f7f-8a74-b5c18fae0f4c',
		user_id: 'b9cf9a4d-2b6b-418f-9fec-953b8449fcbc',
		filename: 'video.mp4',
		mime_type: 'video/mp4',
		total_size: '10',
		chunk_size: '10',
		tmp_path: '/tmp/video.mp4',
		converted_tmp_path: '/tmp/video.converted.mp4',
		phase: 'converting',
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
	} as MutableVideo;
}

describe('WorkflowRunnerService', () => {
	it('retries transient phase failure and advances within retry budget', async () => {
		const state = makeVideo({ phase: 'converting' });
		const recordFailures: Array<{ phase: UploadPhase; error: string }> = [];
		const setPhaseCalls: Array<{ phase: UploadPhase; clearWorkflowFailureState?: boolean }> = [];

		const repo = {
			async findById() {
				return { ...state };
			},
			async setPhase(
				_id: string,
				phase: UploadPhase,
				opts?: { clearWorkflowFailureState?: boolean; clearTerminalFailureState?: boolean },
			) {
				setPhaseCalls.push({ phase, clearWorkflowFailureState: opts?.clearWorkflowFailureState });
				state.phase = phase;
				if (opts?.clearWorkflowFailureState) {
					state.workflow_retry_phase = null;
					state.workflow_retry_count = 0;
					state.workflow_last_error = null;
					state.workflow_last_error_at = null;
				}
				return { ...state };
			},
			async recordWorkflowFailure(_id: string, phase: UploadPhase, errorMessage: string) {
				recordFailures.push({ phase, error: errorMessage });
				state.workflow_retry_count = state.workflow_retry_phase === phase ? state.workflow_retry_count + 1 : 1;
				state.workflow_retry_phase = phase;
				state.workflow_last_error = errorMessage;
				state.workflow_last_error_at = new Date();
				return { ...state };
			},
			async markUploadFailedTerminal() {
				throw new Error('Should not mark terminal failure for transient issue');
			},
		};

		const policy: Pick<VideoUploadWorkflowPolicyService, 'retryLimitForPhase' | 'computeBackoffMs'> = {
			retryLimitForPhase(phase) {
				return phase === 'converting' ? 1 : 0;
			},
			computeBackoffMs() {
				return 0;
			},
		};

		const sseEvents: Array<{ videoId: string; phase: UploadPhase }> = [];
		const sse = {
			sendEvent(_userId: string, _event: string, payload: { videoId: string; phase: UploadPhase }) {
				sseEvents.push(payload);
			},
		};

		const runner = new WorkflowRunnerService(repo as any, {} as any, {} as any, policy as any, sse as any);
		let convertingAttempts = 0;
		let compensateCalls = 0;
		(runner as any).handlers = {
			receiving: { handle: () => ({ kind: 'terminal' }) },
			'receiving-gate': { handle: () => ({ kind: 'terminal' }) },
			converting: {
				handle: () => {
					convertingAttempts += 1;
					if (convertingAttempts === 1) throw new Error('transient');
					return { kind: 'advance', nextPhase: 'hashing' };
				},
				compensate: () => {
					compensateCalls += 1;
				},
			},
			hashing: { handle: () => ({ kind: 'terminal' }) },
			uploading_s3: { handle: () => ({ kind: 'terminal' }) },
			completed: { handle: () => ({ kind: 'terminal' }) },
			failed: { handle: () => ({ kind: 'terminal' }) },
		};

		const result = await runner.advance(state.id);

		expect(result.terminal).to.equal(true);
		expect(result.toPhase).to.equal('hashing');
		expect(convertingAttempts).to.equal(2);
		expect(compensateCalls).to.equal(1);
		expect(recordFailures).to.have.length(1);
		expect(setPhaseCalls).to.have.length(1);
		expect(setPhaseCalls[0].phase).to.equal('hashing');
		expect(setPhaseCalls[0].clearWorkflowFailureState).to.equal(true);
		expect(state.workflow_retry_count).to.equal(0);
		expect(state.workflow_retry_phase).to.equal(null);
		expect(sseEvents).to.deep.equal([{ videoId: state.id, phase: 'hashing' }]);
	});

	it('marks upload failed after retry budget is exhausted', async () => {
		const state = makeVideo({ phase: 'converting' });
		const compensateExhaustedFlags: boolean[] = [];
		let markFailedCalls = 0;

		const repo = {
			async findById() {
				return { ...state };
			},
			async setPhase() {
				throw new Error('setPhase should not be called on permanent failure');
			},
			async recordWorkflowFailure(_id: string, phase: UploadPhase, errorMessage: string) {
				state.workflow_retry_phase = phase;
				state.workflow_retry_count += 1;
				state.workflow_last_error = errorMessage;
				state.workflow_last_error_at = new Date();
				return { ...state };
			},
			async markUploadFailedTerminal(_id: string, failedPhase: UploadPhase, reason: string) {
				markFailedCalls += 1;
				state.phase = 'failed';
				state.upload_failed_phase = failedPhase;
				state.upload_failed_reason = reason;
				state.upload_failed_at = new Date();
				return { ...state };
			},
		};

		const policy: Pick<VideoUploadWorkflowPolicyService, 'retryLimitForPhase' | 'computeBackoffMs'> = {
			retryLimitForPhase(phase) {
				return phase === 'converting' ? 1 : 0;
			},
			computeBackoffMs() {
				return 0;
			},
		};

		const sseEvents: Array<{ videoId: string; phase: UploadPhase }> = [];
		const sse = {
			sendEvent(_userId: string, _event: string, payload: { videoId: string; phase: UploadPhase }) {
				sseEvents.push(payload);
			},
		};

		const runner = new WorkflowRunnerService(repo as any, {} as any, {} as any, policy as any, sse as any);
		(runner as any).handlers = {
			receiving: { handle: () => ({ kind: 'terminal' }) },
			'receiving-gate': { handle: () => ({ kind: 'terminal' }) },
			converting: {
				handle: () => {
					throw new Error('permanent');
				},
				compensate: (_video: Video, _error: Error, context: { exhausted: boolean }) => {
					compensateExhaustedFlags.push(context.exhausted);
				},
			},
			hashing: { handle: () => ({ kind: 'terminal' }) },
			uploading_s3: { handle: () => ({ kind: 'terminal' }) },
			completed: { handle: () => ({ kind: 'terminal' }) },
			failed: { handle: () => ({ kind: 'terminal' }) },
		};

		const result = await runner.advance(state.id);

		expect(result.terminal).to.equal(true);
		expect(result.toPhase).to.equal('failed');
		expect(markFailedCalls).to.equal(1);
		expect(state.upload_failed_phase).to.equal('converting');
		expect(state.upload_failed_reason).to.equal('permanent');
		expect(compensateExhaustedFlags).to.deep.equal([false, true]);
		expect(sseEvents).to.deep.equal([{ videoId: state.id, phase: 'failed' }]);
	});
});
