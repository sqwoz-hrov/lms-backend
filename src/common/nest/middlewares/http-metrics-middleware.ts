import { Injectable, NestMiddleware } from '@nestjs/common';
import { httpRequestsTotal, httpResponsesTotal } from '../../metrics/metrics';
import { NextFunction, Response } from 'express';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
	use(req: Request, res: Response, next: NextFunction) {
		httpRequestsTotal.inc();
		res.on('finish', () => {
			const group = `${Math.floor(res.statusCode / 100)}xx`;
			httpResponsesTotal.inc({ group });
		});

		next();
	}
}
