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

		let resolveMetadata: (() => void) | undefined;
		let rejectMetadata: ((reason?: unknown) => void) | undefined;
		let metadataResolved = false;

		const metadataPromise = new Promise<void>((resolve, reject) => {
			resolveMetadata = resolve;
			rejectMetadata = reject;
		});

		const markMetadataReady = () => {
			if (!metadataResolved) {
				metadataResolved = true;
				resolveMetadata?.();
			}
		};

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

		const parsedFile: RequestWithFile['parsed-file'] = {
			stream: fileStream,
			formParsePromise,
			metadataPromise,
		};
		form.on('file', (_fieldName, file) => {
			parsedFile.filename = file.originalFilename ?? undefined;
			markMetadataReady();
		});
		form.on('fileBegin', (_fieldName, file) => {
			parsedFile.filename = file.originalFilename ?? parsedFile.filename;
			markMetadataReady();
		});
		form.on('error', err => {
			if (!metadataResolved) rejectMetadata?.(err);
		});
		formParsePromise.catch(err => {
			if (!metadataResolved) rejectMetadata?.(err);
		});

		req['parsed-file'] = parsedFile;
		return next.handle();
	}
}
