import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { JournalRecordRepository } from '../../journal-record.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { UpdateJournalRecordDto } from '../../dto/update-journal-record.dto';
import { BaseJournalRecordDto } from '../../dto/base-journal-record.dto';

@Injectable()
export class EditJournalRecordUsecase implements UsecaseInterface {
	constructor(
		private readonly journalRecordRepository: JournalRecordRepository,
		@Inject(MarkdownContentService)
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(params: UpdateJournalRecordDto): Promise<BaseJournalRecordDto> {
		const { id, markdown_content, ...updates } = params;

		const existing = await this.journalRecordRepository.findById(id);

		if (!existing) {
			throw new NotFoundException('Запись не найдена');
		}

		const markDownContent = markdown_content
			? await this.markdownContentService.updateMarkdownContent(existing.markdown_content_id, markdown_content)
			: await this.markdownContentService.getMarkdownContent(existing.markdown_content_id);

		const updated = await this.journalRecordRepository.update(id, updates);

		return {
			...updated,
			markdown_content: markDownContent.content_text,
		};
	}
}
