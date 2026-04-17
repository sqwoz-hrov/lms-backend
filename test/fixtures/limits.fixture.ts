import { DatabaseProvider } from '../../src/infra/db/db.provider';
import { LimitsTestRepository } from '../../src/limits/test-utils/test.repo';

// TODO: refactor to 2 separate fixtures for get-limits and interview-transcription limits, as they might diverge in the future and have different helper methods
export const createLimitsFixture = (dbProvider: DatabaseProvider) => {
	const limitsRepo = new LimitsTestRepository(dbProvider);

	return {
		insertUsageRecords: async ({ userId, count }: { userId: string; count: number }) => {
			await limitsRepo.insertUsageRecords({ userId, count });
		},
		countUsageRecords: async ({ userId }: { userId: string }) => {
			return await limitsRepo.countInterviewTranscriptionUsageByUser(userId);
		},
	};
};
