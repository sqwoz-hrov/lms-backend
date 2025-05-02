import { Type, UseFilters, UseInterceptors, applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { AllExceptionsFilter } from '../exception-filters/all-exceptions.filter';
import { RequestLoggerInterceptor } from '../interceptors/request-logger.interceptor';

export const Route = ({
	summary,
	description,
	responseType,
	isArray,
}: {
	summary: string;
	description?: string;
	responseType?: Type<unknown>;
	isArray?: boolean;
}) =>
	applyDecorators(
		UseFilters(AllExceptionsFilter),
		UseInterceptors(RequestLoggerInterceptor),
		ApiOperation({ summary, description }),
		ApiSecurity('signature'),
		ApiResponse({
			status: 'default',
			description: 'Тело ответа',
			type: responseType,
			isArray: isArray ?? false,
		}),
	);
