import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { DatabaseProvider } from '../infra/db/db.provider';
import { Feedback, NewFeedback, FeedbackUpdate, FeedbackAggregation } from './feedback.entity';
import { InterviewAggregation } from '../interview/interview.entity';
import { HrConnectionAggregation } from '../hr-connection/hr-connection.entity';

@Injectable()
export class FeedbackRepository {
	private readonly connection: Kysely<FeedbackAggregation & InterviewAggregation & HrConnectionAggregation>;

	constructor(@Inject(DatabaseProvider) dbProvider: DatabaseProvider) {
		this.connection = dbProvider.getDatabase<FeedbackAggregation & InterviewAggregation & HrConnectionAggregation>();
	}

	async save(data: NewFeedback): Promise<Feedback> {
		return await this.connection
			.insertInto('feedback')
			.values({ ...data })
			.returningAll()
			.executeTakeFirstOrThrow();
	}

	async findById(id: string): Promise<Feedback | undefined> {
		return await this.connection.selectFrom('feedback').selectAll().where('id', '=', id).executeTakeFirst();
	}

	async find(filter: Partial<Feedback> = {}, userId?: string): Promise<Feedback[]> {
		let query = this.connection
			.selectFrom('feedback')
			.innerJoin('interview', 'interview.id', 'feedback.interview_id')
			.innerJoin('hr_connection', 'hr_connection.id', 'interview.hr_connection_id')
			.selectAll('feedback');

		if (userId) {
			query = query.where('hr_connection.student_user_id', '=', userId);
		}

		for (const key in filter) {
			query = query.where(`feedback.${key}` as keyof typeof filter, '=', filter[key as keyof typeof filter]!);
		}
		return await query.execute();
	}

	async update(id: string, updates: FeedbackUpdate): Promise<Feedback> {
		return await this.connection
			.updateTable('feedback')
			.set(updates)
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirstOrThrow();
	}
}
