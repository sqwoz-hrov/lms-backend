import { INestApplication } from '@nestjs/common';

export function setupCors(app: INestApplication) {
	const rawOrigins = process.env.CORS_ORIGINS?.trim();
	const origin =
		!rawOrigins || rawOrigins.length === 0
			? []
			: rawOrigins === '*'
				? true
				: rawOrigins
						.split(',')
						.map(value => value.trim())
						.filter(Boolean);

	app.enableCors({
		origin,
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
		exposedHeaders: ['Upload-Session-Id', 'Upload-Offset', 'Upload-Length', 'Location'],
		credentials: true,
	});
}
