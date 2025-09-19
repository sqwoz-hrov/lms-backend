import { INestApplication } from '@nestjs/common';

export function setupCors(app: INestApplication) {
	app.enableCors({
		origin: process.env.CORS_ORIGINS?.split(',') ?? [],
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
		credentials: true,
	});
}
