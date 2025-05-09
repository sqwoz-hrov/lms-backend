import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { IncomingForm } from 'formidable';
import { Observable } from 'rxjs';
import { PassThrough } from 'stream';
import { RequestWithFile } from '../../interface/request-with-files.interface';

@Injectable()
export class FileParserInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> {
		const req = context.switchToHttp().getRequest<RequestWithFile>();

		const fileStream = new PassThrough();

		fileStream.on('data', () => {
			console.log('data is going');
		});

		const form = new IncomingForm({
			multiples: false,
			keepExtensions: false,
			allowEmptyFiles: false,
			fileWriteStreamHandler: () => fileStream,
		});

		const formParsePromise = form.parse(req).catch(() => {
			throw new BadRequestException('Uploaded file is not valid');
		});

		req['parsed-file'] = {
			stream: fileStream,
			formParsePromise,
		};

		return next.handle();
	}
}
