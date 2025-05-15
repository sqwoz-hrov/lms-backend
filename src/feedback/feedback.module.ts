import { Module } from '@nestjs/common';
import { HrConnectionModule } from '../hr-connection/hr-connection.module';
import { InterviewModule } from '../interview/interview.module';
import { CreateFeedbackController } from './usecases/create-feedback/create-feedback.controller';
import { EditFeedbackController } from './usecases/edit-feedback/edit-feedback.controller';
import { GetAllFeedbackController } from './usecases/get-all-feedback/get-all-feedback.controller';
import { GetFeedbackInfoController } from './usecases/get-feedback-info/get-feedback-info.controller';
import { CreateFeedbackUsecase } from './usecases/create-feedback/create-feedback.usecase';
import { EditFeedbackUsecase } from './usecases/edit-feedback/edit-feedback.usecase';
import { GetAllFeedbackUsecase } from './usecases/get-all-feedback/get-all-feedback.usecase';
import { GetFeedbackInfoUsecase } from './usecases/get-feedback-info/get-feedback-info.usecase';
import { FeedbackRepository } from './feedback.repository';

@Module({
	imports: [InterviewModule, HrConnectionModule],
	controllers: [CreateFeedbackController, EditFeedbackController, GetAllFeedbackController, GetFeedbackInfoController],
	providers: [
		CreateFeedbackUsecase,
		EditFeedbackUsecase,
		GetAllFeedbackUsecase,
		GetFeedbackInfoUsecase,
		FeedbackRepository,
	],
	exports: [],
})
export class FeedbackModule {}
