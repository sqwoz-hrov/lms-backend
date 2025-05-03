import { Module } from '@nestjs/common';
import { IMAGE_STORAGE_ADAPTER } from './constants';
import { MarkdownContentService } from './services/markdown-content.service';
import { FakeImageStorageAdapter } from './adapter/fake-image-storage.adapter';
import { ImageStorageAdapter } from './adapter/image-storage.adapter';
import { MarkdownProcessorService } from './services/markdown-processor.service';
import { MarkdownContentRespository } from './markdown-content.repository';

@Module({})
export class MarkdownContentModule {
	static forRoot({ useRealImageStorage }: { useRealImageStorage: boolean }) {
		return {
			module: MarkdownContentModule,
			global: true,
			providers: [
				{
					provide: IMAGE_STORAGE_ADAPTER,
					useClass: useRealImageStorage ? ImageStorageAdapter : FakeImageStorageAdapter,
				},
				MarkdownContentService,
				MarkdownProcessorService,
				MarkdownContentRespository,
			],
			exports: [MarkdownContentService],
		};
	}
}
