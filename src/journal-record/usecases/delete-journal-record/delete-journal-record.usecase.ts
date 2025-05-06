import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { BaseJournalRecordDto } from '../../dto/base-journal-record.dto';
import { DeleteJournalRecordDto } from '../../dto/delete-journal-record.dto';
import { JournalRecordRepository } from '../../journal-record.repository';

@Injectable()
export class DeleteJournalRecordUsecase implements UsecaseInterface {
	constructor(
		private readonly journalRecordRepository: JournalRecordRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(params: DeleteJournalRecordDto): Promise<BaseJournalRecordDto> {
		const record = await this.journalRecordRepository.findById(params.id);
		if (!record) {
			throw new NotFoundException('Запись не найдена');
		}

		const deleted = await this.journalRecordRepository.delete(params.id);

		const markDownContent = await this.markdownContentService.deleteMakdownContent(deleted.markdown_content_id);

		return {
			...deleted,
			markdown_content: markDownContent?.content_text ?? '',
		};
	}
}
