import { Global, Module } from '@nestjs/common';
import { MarkdownContentService } from './services/markdown-content.service';
import { MarkdownProcessorService } from './services/markdown-processor.service';
import { MarkdownContentRespository } from './markdown-content.repository';

@Global()
@Module({
	providers: [MarkdownContentService, MarkdownProcessorService, MarkdownContentRespository],
	exports: [MarkdownContentService],
})
export class MarkdownContentModule {}
