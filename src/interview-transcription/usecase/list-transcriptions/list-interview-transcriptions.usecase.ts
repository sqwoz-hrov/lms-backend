import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { InterviewTranscriptionResponseDto } from '../../dto/interview-transcription-response.dto';
import { ListInterviewTranscriptionsDto } from '../../dto/list-interview-transcriptions.dto';
import { InterviewTranscriptionRepository } from '../../interview-transcription.repository';

@Injectable()
export class ListInterviewTranscriptionsUsecase implements UsecaseInterface {
	constructor(private readonly transcriptionRepository: InterviewTranscriptionRepository) {}

	async execute({
		user,
		params,
	}: {
		user: UserWithSubscriptionTier;
		params: ListInterviewTranscriptionsDto;
	}): Promise<InterviewTranscriptionResponseDto[]> {
		if (user.role === 'admin') {
			return await this.transcriptionRepository.findAll({ userId: params.user_id });
		}

		return await this.transcriptionRepository.findForUser(user.id);
	}
}
