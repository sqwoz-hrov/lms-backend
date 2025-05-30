import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DEFAULT_ERROR_MESSAGE } from './common/nest/const';

export const createSwagger = (nestApplication: INestApplication) => {
	const config = new DocumentBuilder()
		.addServer(process.env.SWAGGER_BASE_URL ?? 'http://localhost:3000')
		.setTitle('Sqwoz Hrov LMS')
		.setDescription(`Документация API ЛМС Sqwoz Hrov`)
		.setVersion('1.0')
		.addBearerAuth()
		.addGlobalResponse({
			status: 500,
			description: 'Что-то пошло не так на нашей стороне :(',
			schema: {
				type: 'object',
				properties: {
					message: {
						type: 'string',
						description: 'Сообщение об ошибке',
						enum: [DEFAULT_ERROR_MESSAGE],
					},
				},
			},
		})
		.build();

	const document = SwaggerModule.createDocument(nestApplication, config);

	SwaggerModule.setup('api', nestApplication, document, {
		customSiteTitle: 'Sqwoz Hrov LMS API',
		yamlDocumentUrl: '/api/openapi.yaml',
		jsonDocumentUrl: '/api/openapi.json',
	});

	return JSON.stringify(document);
};
