import { INestApplication, ValidationPipe } from '@nestjs/common';

export const setupValidation = (app: INestApplication) => {
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
			forbidNonWhitelisted: false,
			transformOptions: { enableImplicitConversion: false },
		}),
	);
};
