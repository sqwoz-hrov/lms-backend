import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { InterviewTranscriptionReportRepository } from '../../interview-transcription-report.repository';
import { InterviewTranscriptionReport } from '../../interview-transcription-report.entity';
import { InterviewTranscriptionRepository } from '../../../interview-transcription/interview-transcription.repository';

export interface GetTranscriptionReportParams {
	transcription_id: string;
}

@Injectable()
export class GetTranscriptionReportUsecase implements UsecaseInterface {
	constructor(
		private readonly transcriptionRepository: InterviewTranscriptionRepository,
		private readonly reportRepository: InterviewTranscriptionReportRepository,
	) {}

	async execute({
		params,
		user,
	}: {
		params: GetTranscriptionReportParams;
		user: UserWithSubscriptionTier;
	}): Promise<InterviewTranscriptionReport> {
		const transcription = await this.transcriptionRepository.findById(params.transcription_id);
		if (!transcription) {
			throw new NotFoundException('Транскрибация не найдена');
		}

		if (user.role !== 'admin') {
			const video = await this.transcriptionRepository.findByIdWithVideo(params.transcription_id);
			if (!video || video.video.user_id !== user.id) {
				throw new ForbiddenException('Вы можете просматривать отчёты только своих транскрибаций');
			}
		}

		const report = await this.reportRepository.findByTranscriptionId(params.transcription_id);
		if (!report) {
			throw new NotFoundException('Отчёт для данной транскрибации не найден');
		}

		return report;
	}
}
