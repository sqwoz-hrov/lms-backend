import { DynamicModule } from '@nestjs/common';
import { IMAGE_STORAGE_SERVICE } from './constants';
import { ImageStorageService } from './services/image-storage.service';
import { FakeImageStorageService } from './services/fake-image-storage.service';

export class ImageModule {
	static forRoot({ useRealStorageAdapters }: { useRealStorageAdapters: boolean }): DynamicModule {
		if (useRealStorageAdapters) {
			return {
				module: ImageModule,
				global: true,
				providers: [
					{
						provide: IMAGE_STORAGE_SERVICE,
						useClass: ImageStorageService,
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
					provide: IMAGE_STORAGE_SERVICE,
					useClass: FakeImageStorageService,
				},
				ImageStorageService,
			],
			exports: [ImageStorageService],
		};
	}
}
