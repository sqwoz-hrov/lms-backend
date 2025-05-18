import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const createSwagger = (nestApplication: INestApplication) => {
	const config = new DocumentBuilder()
		.addServer(process.env.SWAGGER_BASE_URL ?? 'http://localhost:3000')
		.setTitle('Sqwoz Hrov LMS')
		.setDescription(`Документация API ЛМС Sqwoz Hrov`)
		.setVersion('1.0')
		.addBearerAuth()
		.build();

	const document = SwaggerModule.createDocument(nestApplication, config);

	SwaggerModule.setup('api', nestApplication, document, {
		customSiteTitle: 'Sqwoz Hrov LMS API',
	});

	return JSON.stringify(document);
};
