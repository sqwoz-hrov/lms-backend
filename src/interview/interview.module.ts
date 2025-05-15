import { Module } from '@nestjs/common';
import { HrConnectionModule } from '../hr-connection/hr-connection.module';
import { CreateInterviewController } from './usecases/create-interview/create-interview.controller';
import { DeleteInterviewController } from './usecases/delete-interview/delete-interview.controller';
import { EditInterviewController } from './usecases/edit-interview/edit-interview.controller';
import { GetInterviewsController } from './usecases/get-interviews/get-interviews.controller';
import { CreateInterviewUsecase } from './usecases/create-interview/create-interview.usecase';
import { DeleteInterviewUsecase } from './usecases/delete-interview/delete-interview.usecase';
import { EditInterviewUsecase } from './usecases/edit-interview/edit-interview.usecase';
import { GetInterviewsUsecase } from './usecases/get-interviews/get-interviews.usecase';
import { InterviewRepository } from './interview.repository';

@Module({
	imports: [HrConnectionModule],
	controllers: [CreateInterviewController, DeleteInterviewController, EditInterviewController, GetInterviewsController],
	providers: [
		CreateInterviewUsecase,
		DeleteInterviewUsecase,
		EditInterviewUsecase,
		GetInterviewsUsecase,
		InterviewRepository,
	],
	exports: [],
})
export class InterviewModule {}
