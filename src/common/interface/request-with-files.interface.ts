import { Request } from 'express';
import { Fields, Files } from 'formidable';
import { Readable } from 'stream';

export interface RequestWithFile extends Request {
	'parsed-file': {
		stream: Readable;
		formParsePromise: Promise<[Fields<string>, Files<string>]>;
		filename?: string;
		mimeType?: string;
		metadataPromise: Promise<void>;
	};
}
