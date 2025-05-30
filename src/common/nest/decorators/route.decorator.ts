import { Type, UseFilters, UseInterceptors, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AllExceptionsFilter } from '../exception-filters/all-exceptions.filter';
import { RequestLoggerInterceptor } from '../interceptors/request-logger.interceptor';
// This is a hack but it helps with typing
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export const Route = ({
	summary,
	description,
	responseType,
	isArray,
	possibleErrors,
}: {
	summary: string;
	description?: string;
	responseType?: Type<unknown>;
	isArray?: boolean;
	possibleErrors?: {
		status?: number;
		description?: string;
		schema?: SchemaObject;
	}[];
}) =>
	applyDecorators(
		UseFilters(AllExceptionsFilter),
		UseInterceptors(RequestLoggerInterceptor),
		ApiBearerAuth(),
		ApiOperation({ summary, description }),
		ApiResponse({
			status: 'default',
			description: 'Тело ответа',
			type: responseType,
			isArray: isArray ?? false,
		}),
		...(possibleErrors?.map(type =>
			ApiResponse({
				status: type.status ?? 500,
				description: type.description ?? 'Ошибка',
				...(type.schema && {
					content: {
						'application/json': {
							schema: type.schema,
						},
					},
				}),
			}),
		) ?? []),
	);
