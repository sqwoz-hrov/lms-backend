import { Module } from '@nestjs/common';
import { CreateSubjectController } from './usecases/create-subject/create-subject.controller';
import { EditSubjectController } from './usecases/edit-subject/edit-subject.controller';
import { GetSubjectsController } from './usecases/get-subjects/get-subjects.controller';
import { CreateSubjectUsecase } from './usecases/create-subject/create-subject.usecase';
import { EditSubjectUsecase } from './usecases/edit-subject/edit-subject.usecase';
import { GetSubjectsUsecase } from './usecases/get-subjects/get-subjects.usecase';
import { SubjectRepository } from './subject.repository';

@Module({
	controllers: [CreateSubjectController, EditSubjectController, GetSubjectsController],
	providers: [CreateSubjectUsecase, EditSubjectUsecase, GetSubjectsUsecase, SubjectRepository],
})
export class SubjectModule {}
