import { Type, UseFilters, UseInterceptors, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
		ApiBearerAuth(),
		ApiOperation({ summary, description }),
		ApiResponse({
			status: 'default',
			description: 'Тело ответа',
			type: responseType,
			isArray: isArray ?? false,
		}),
	);
