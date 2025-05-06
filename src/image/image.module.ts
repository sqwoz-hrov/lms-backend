import { DynamicModule } from '@nestjs/common';
import { IMAGE_STORAGE_ADAPTER } from './constants';
import { ImageStorageAdapter } from './adapters/image-storage.adapter';
import { FakeImageStorageAdapter } from './adapters/fake-image-storage.adapter';
import { ImageStorageService } from './services/image-storage.service';

export class ImageModule {
	static forRoot({ useRealStorageAdapters }: { useRealStorageAdapters: boolean }): DynamicModule {
		if (useRealStorageAdapters) {
			return {
				module: ImageModule,
				global: true,
				providers: [
					{
						provide: IMAGE_STORAGE_ADAPTER,
						useClass: ImageStorageAdapter,
					},
					ImageStorageService,
				],
				exports: [ImageStorageService],
			};
		}
		return {
			module: ImageModule,
			global: true,
			providers: [
				{
					provide: IMAGE_STORAGE_ADAPTER,
					useClass: FakeImageStorageAdapter,
				},
				ImageStorageService,
			],
			exports: [ImageStorageService],
		};
	}
}
