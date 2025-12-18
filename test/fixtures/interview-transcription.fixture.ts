import {
	InterviewTranscription,
	NewInterviewTranscription,
} from '../../src/interview-transcription/interview-transcription.entity';
import { InterviewTranscriptionsTestRepository } from '../../src/interview-transcription/test-utils/test.repo';

export const createTestInterviewTranscription = async (
	interviewTranscriptionsRepository: InterviewTranscriptionsTestRepository,
	videoId: string,
	overrides: Partial<NewInterviewTranscription> = {},
): Promise<InterviewTranscription> => {
	return await interviewTranscriptionsRepository.connection
		.insertInto('interview_transcription')
		.values({
			video_id: videoId,
			status: 'done',
			s3_transcription_key: 'transcriptions/result.json',
			created_at: new Date(),
			updated_at: new Date(),
			...overrides,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
};
