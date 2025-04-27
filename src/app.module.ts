import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { dbConfig } from './configs/db.config';

@Module({
	imports: [
		ConfigModule.forRoot({
			load: [dbConfig],
			isGlobal: true,
		}),
	],
	controllers: [],
	providers: [],
})
export class AppModule {}
