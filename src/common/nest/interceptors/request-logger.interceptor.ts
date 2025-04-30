import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
	private readonly logger = new Logger(RequestLoggerInterceptor.name);

	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const req = context.switchToHttp().getRequest<Request>();

		this.logger.debug(`Request ${req.url}`, {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			body: 'body' in req && req.body ? req.body : undefined,
			headers: req.headers,
			method: req.method,
			ip: req.ip,
			hostname: req.hostname,
		});

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		return next.handle().pipe(tap(response => this.logger.debug(`Response ${req.url}`, { response })));
	}
}
