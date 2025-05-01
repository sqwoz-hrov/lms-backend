import { Injectable } from '@nestjs/common';
import { MarkDownContent } from '../markdown-content.entity';
import { MarkdownContentRespository } from '../markdown-content.repository';
import { MarkdownProcessorService } from './markdown-processor.service';

@Injectable()
export class MarkdownContentService {
	constructor(
		private readonly markdownContentRepository: MarkdownContentRespository,
		private readonly markdownProcessor: MarkdownProcessorService,
	) {}

	async uploadMarkdownContent(content: string): Promise<MarkDownContent> {
		const processedContent = await this.markdownProcessor.processMarkdown(content);

		const markdownContent = await this.markdownContentRepository.save({
			content_text: processedContent,
		});

		if (!markdownContent) {
			throw new Error('Failed to save markdown content');
		}

		return markdownContent;
	}

	async getMarkdownContent(id: string): Promise<string> {
		const markdownContent = await this.markdownContentRepository.findById(id);

		if (!markdownContent) {
			throw new Error('Markdown content not found');
		}

		return markdownContent.content_text;
	}

	async updateMarkdownContent(id: string, content: string): Promise<void> {
		const markdownContent = await this.markdownContentRepository.findById(id);

		if (!markdownContent) {
			throw new Error('Markdown content not found');
		}

		const processedContent = await this.markdownProcessor.processMarkdown(content);

		await this.markdownContentRepository.update(id, {
			content_text: processedContent,
		});
	}

	async deleteMakdownContent(id: string): Promise<MarkDownContent | undefined> {
		return this.markdownContentRepository.delete(id);
	}
}
