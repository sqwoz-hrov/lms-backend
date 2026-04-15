import { Kysely } from 'kysely';
import { DatabaseProvider } from '../../infra/db/db.provider';
import { UserAiUsageTable } from '../ai-usage.entity';

type LimitsTestDb = {
	user_ai_usage: UserAiUsageTable;
};

export class LimitsTestRepository {
	private readonly connection: Kysely<LimitsTestDb>;

	constructor(dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<LimitsTestDb>();
	}

	async insertUsageRecords({ userId, count }: { userId: string; count: number }): Promise<void> {
		for (let i = 0; i < count; i++) {
			await this.connection
				.insertInto('user_ai_usage')
				.values({
					user_id: userId,
					feature: 'interview_transcription',
				})
				.execute();
		}
	}

	async countInterviewTranscriptionUsageByUser(userId: string): Promise<number> {
		const usageCountRes = await this.connection
			.selectFrom('user_ai_usage')
			.select(({ fn }) => fn.count<number>('id').as('count'))
			.where('user_id', '=', userId)
			.where('feature', '=', 'interview_transcription')
			.limit(1)
			.executeTakeFirst();

		return Number(usageCountRes?.count ?? 0);
	}
}
