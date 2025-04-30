import {
	ArgumentsHost,
	BadRequestException,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	public constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

	public catch(exception: any, host: ArgumentsHost): void {
		const { httpAdapter } = this.httpAdapterHost;

		const ctx = host.switchToHttp();

		const maybeClassValidatorError = exception?.response?.message as unknown as string | undefined;
		const maybeGeneralError = exception?.message as unknown as string | undefined;

		// ignoring `BadRequestException` since they are thrown by class-validator
		if (!(exception instanceof BadRequestException)) {
			this.logger.error('Unexpected error', exception);
		}

		const errorMessage = maybeClassValidatorError || maybeGeneralError || 'Unexpected error';

		httpAdapter.reply(
			ctx.getResponse(),
			{
				description: typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage),
			},
			exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR,
		);
	}
}
