import {
	BadRequestException,
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
	Optional,
} from '@nestjs/common';
import { IncomingForm } from 'formidable';
import { Observable } from 'rxjs';
import { PassThrough } from 'stream';
import { RequestWithFile } from '../../interface/request-with-files.interface';
import { FormidableTimingProbe } from '../../testing/formidable-timing-probe';

@Injectable()
export class FileParserInterceptor implements NestInterceptor {
	constructor(@Optional() private readonly timingProbe?: FormidableTimingProbe) {}

	intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> {
		const req = context.switchToHttp().getRequest<RequestWithFile>();

		this.timingProbe?.onRequestStart();

		const fileStream = new PassThrough();

		const form = new IncomingForm({
			multiples: false,
			keepExtensions: false,
			allowEmptyFiles: false,
			fileWriteStreamHandler: () => fileStream,
		});

		this.timingProbe?.onParseStart();

		const formParsePromise = form
			.parse(req)
			.then(res => {
				this.timingProbe?.onParseEnd();
				return res;
			})
			.catch(() => {
				this.timingProbe?.onParseEnd();
				throw new BadRequestException('Uploaded file is not valid');
			});

		req['parsed-file'] = { stream: fileStream, formParsePromise };
		return next.handle();
	}
}
