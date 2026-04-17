import { expect } from 'chai';
import { LimitsService } from './limits.service';

describe('LimitsService', () => {
	const createService = (
		overrides: Partial<{ interviewTranscriptionHourly: number; interviewTranscriptionDaily: number }> = {},
	) => {
		return new LimitsService({
			interviewTranscriptionHourly: 2,
			interviewTranscriptionDaily: 5,
			...overrides,
		} as never);
	};

	it('returns configured applied limits for interview transcription', () => {
		const service = createService();

		const applied = service.getAppliedLimitsForUser('interview_transcription');

		expect(applied).to.have.length(2);
		expect(applied.map(limit => limit.getName())).to.have.members([
			'interview_transcription_hourly_2',
			'interview_transcription_daily_5',
		]);
	});

	it('returns exceeded hourly limit', () => {
		const service = createService();

		const exceeded = service.getExceededLimitsForUser('interview_transcription', {
			lastHour: 2,
			lastDay: 1,
		});

		expect(exceeded.map(limit => limit.getName())).to.deep.equal(['interview_transcription_hourly_2']);
	});

	it('returns exceeded daily limit', () => {
		const service = createService();

		const exceeded = service.getExceededLimitsForUser('interview_transcription', {
			lastHour: 1,
			lastDay: 5,
		});

		expect(exceeded.map(limit => limit.getName())).to.deep.equal(['interview_transcription_daily_5']);
	});

	it('returns both exceeded limits when both thresholds are reached', () => {
		const service = createService();

		const exceeded = service.getExceededLimitsForUser('interview_transcription', {
			lastHour: 3,
			lastDay: 6,
		});

		expect(exceeded.map(limit => limit.getName())).to.have.members([
			'interview_transcription_hourly_2',
			'interview_transcription_daily_5',
		]);
	});

	it('returns empty list when no limits are exceeded', () => {
		const service = createService();

		const exceeded = service.getExceededLimitsForUser('interview_transcription', {
			lastHour: 1,
			lastDay: 4,
		});

		expect(exceeded).to.have.length(0);
	});
});
