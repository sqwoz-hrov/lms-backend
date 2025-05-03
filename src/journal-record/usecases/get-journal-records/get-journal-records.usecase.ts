import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { GetJournalRecordsDto } from '../../dto/get-journal-records.dto';
import { JournalRecordRepository } from '../../journal-record.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { BaseJournalRecordDto } from '../../dto/base-journal-record.dto';

@Injectable()
export class GetJournalRecordsUsecase implements UsecaseInterface {
	constructor(
		private readonly journalRecordRepository: JournalRecordRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(params: GetJournalRecordsDto): Promise<BaseJournalRecordDto[]> {
		const records = await this.journalRecordRepository.find(params);

		const enrichedRecords = await Promise.all(
			records.map(async record => {
				const markDownContent = await this.markdownContentService.getMarkdownContent(record.markdown_content_id);
				return {
					...record,
					markdown_content: markDownContent.content_text,
				};
			}),
		);

		return enrichedRecords;
	}
}
