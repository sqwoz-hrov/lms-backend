import { DynamicModule } from '@nestjs/common';
import { IMAGE_STORAGE_SERVICE } from './constants';
import { ImageStorageService } from './services/image-storage.service';
import { FakeImageStorageService } from './services/fake-image-storage.service';
import { ImageStorageAdapter } from './adapters/image-storage.adapter';

export class ImageModule {
	static forRoot({ useRealStorageAdapters }: { useRealStorageAdapters: boolean }): DynamicModule {
		if (useRealStorageAdapters) {
			return {
				module: ImageModule,
				global: true,
				providers: [
					ImageStorageAdapter,
					{
						provide: IMAGE_STORAGE_SERVICE,
						useClass: ImageStorageService,
					},
				],
				exports: [IMAGE_STORAGE_SERVICE],
			};
		}
		return {
			module: ImageModule,
			global: true,
			providers: [
				{
					provide: IMAGE_STORAGE_SERVICE,
					useClass: FakeImageStorageService,
				},
			],
			exports: [IMAGE_STORAGE_SERVICE],
		};
	}
}
