import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createSwagger } from './swagger';
import { setupCors } from './cors';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	createSwagger(app);
	setupCors(app);
	app.enableShutdownHooks();
	await app.listen(process.env.PORT ?? 3000);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
