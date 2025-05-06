import { applyDecorators, Type, UseFilters, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AllExceptionsFilter } from '../exception-filters/all-exceptions.filter';
import { FileParserInterceptor } from '../interceptors/file-parser.interceptor';
import { RequestLoggerInterceptor } from '../interceptors/request-logger.interceptor';

export function RouteWithFileUpload({
	summary,
	description,
	responseType,
}: {
	summary: string;
	description?: string;
	responseType?: Type<unknown>;
}) {
	return applyDecorators(
		UseFilters(AllExceptionsFilter),
		UseInterceptors(RequestLoggerInterceptor, FileParserInterceptor),
		ApiBearerAuth(),
		ApiOperation({ summary, description }),
		ApiConsumes('multipart/form-data'),
		ApiBody({
			schema: {
				type: 'object',
				properties: {
					file: {
						type: 'string',
						format: 'binary',
						description: 'Файл для загрузки',
					},
				},
				required: ['file'],
			},
		}),
		ApiResponse({
			status: 'default',
			description: 'Тело ответа',
			type: responseType,
		}),
	);
}
