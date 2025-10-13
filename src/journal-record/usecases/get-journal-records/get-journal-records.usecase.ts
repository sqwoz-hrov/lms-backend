import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { GetJournalRecordsDto } from '../../dto/get-journal-records.dto';
import { JournalRecordRepository } from '../../journal-record.repository';
import { BaseJournalRecordDto } from '../../dto/base-journal-record.dto';

@Injectable()
export class GetJournalRecordsUsecase implements UsecaseInterface {
	constructor(private readonly journalRecordRepository: JournalRecordRepository) {}

	async execute(params: GetJournalRecordsDto): Promise<BaseJournalRecordDto[]> {
		return await this.journalRecordRepository.find(params);
	}
}
