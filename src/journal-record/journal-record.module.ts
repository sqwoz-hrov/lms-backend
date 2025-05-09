import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { JournalRecordRepository } from './journal-record.repository';
import { CreateJournalRecordController } from './usecases/create-journal-record/create-journal-record.controller';
import { CreateJournalRecordUsecase } from './usecases/create-journal-record/create-journal-record.usecase';
import { DeleteJournalRecordController } from './usecases/delete-journal-record/delete-journal-record.controller';
import { DeleteJournalRecordUsecase } from './usecases/delete-journal-record/delete-journal-record.usecase';
import { EditJournalRecordController } from './usecases/edit-journal-record/edit-journal-record.controller';
import { EditJournalRecordUsecase } from './usecases/edit-journal-record/edit-journal-record.usecase';
import { GetJournalRecordInfoController } from './usecases/get-journal-record-info/get-journal-record-info.controller';
import { GetJournalRecordInfoUsecase } from './usecases/get-journal-record-info/get-journal-record-info.usecase';
import { GetJournalRecordsController } from './usecases/get-journal-records/get-journal-records.controller';
import { GetJournalRecordsUsecase } from './usecases/get-journal-records/get-journal-records.usecase';

@Module({
	imports: [UserModule],
	controllers: [
		CreateJournalRecordController,
		EditJournalRecordController,
		DeleteJournalRecordController,
		GetJournalRecordInfoController,
		GetJournalRecordsController,
	],
	providers: [
		JournalRecordRepository,
		CreateJournalRecordUsecase,
		EditJournalRecordUsecase,
		DeleteJournalRecordUsecase,
		GetJournalRecordInfoUsecase,
		GetJournalRecordsUsecase,
	],
})
export class JournalRecordModule {}
