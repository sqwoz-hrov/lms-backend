import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { BaseJournalRecordDto } from '../../dto/base-journal-record.dto';
import { JournalRecordRepository } from '../../journal-record.repository';

@Injectable()
export class GetJournalRecordInfoUsecase implements UsecaseInterface {
	constructor(
		private readonly journalRecordRepository: JournalRecordRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(params: { id: string }): Promise<BaseJournalRecordDto> {
		const record = await this.journalRecordRepository.findById(params.id);
		if (!record) {
			throw new NotFoundException('Запись не найдена');
		}

		const markDownContent = await this.markdownContentService.getMarkdownContent(record.markdown_content_id);

		return {
			...record,
			markdown_content: markDownContent?.content_text ?? '',
		};
	}
}
