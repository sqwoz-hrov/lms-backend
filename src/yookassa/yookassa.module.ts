import { DynamicModule, Module } from '@nestjs/common';
import { YOOKASSA_CLIENT } from './constants';
import { YookassaClient } from './services/yookassa.client';
import { FakeYookassaClient } from './services/fake-yookassa.client';

@Module({})
export class YookassaModule {
	static forRoot({ useYookassaAPI }: { useYookassaAPI: boolean }): DynamicModule {
		if (useYookassaAPI) {
			return {
				module: YookassaModule,
				global: true,
				providers: [
					{
						provide: YOOKASSA_CLIENT,
						useClass: YookassaClient,
					},
				],
				exports: [YOOKASSA_CLIENT],
			};
		}

		return {
			module: YookassaModule,
			global: true,
			providers: [
				{
					provide: YOOKASSA_CLIENT,
					useClass: FakeYookassaClient,
				},
			],
			exports: [YOOKASSA_CLIENT],
		};
	}
}
