import { Injectable, Inject } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { JournalRecordRepository } from '../../journal-record.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { UserRepository } from '../../../users/user.repository';
import { CreateJournalRecordDto } from '../../dto/create-journal-record.dto';
import { BaseJournalRecordDto } from '../../dto/base-journal-record.dto';

@Injectable()
export class CreateJournalRecordUsecase implements UsecaseInterface {
	constructor(
		private readonly journalRecordRepository: JournalRecordRepository,
		private readonly userRepository: UserRepository,
		@Inject(MarkdownContentService)
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(params: CreateJournalRecordDto): Promise<BaseJournalRecordDto | undefined> {
		const { student_user_id, name, markdown_content } = params;

		const student = await this.userRepository.findById(student_user_id);
		if (!student) return undefined;

		const markdown = await this.markdownContentService.uploadMarkdownContent(markdown_content);

		const saved = await this.journalRecordRepository.save({
			student_user_id,
			name,
			markdown_content_id: markdown.id,
		});

		return {
			...saved,
			markdown_content: markdown.content_text,
		};
	}
}
