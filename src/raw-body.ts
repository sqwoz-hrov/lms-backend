import { INestApplication, RawBodyRequest } from '@nestjs/common';
import { json, urlencoded } from 'body-parser';
import { Request, Response } from 'express';

const saveRawBody = (req: RawBodyRequest<Request>, _res: Response, buffer: Buffer): void => {
	if (buffer?.length) {
		req.rawBody = Buffer.from(buffer);
	}
};

export const setupRawBodyParsing = (app: INestApplication): void => {
	app.use(
		json({
			verify: saveRawBody,
		}),
	);

	app.use(
		urlencoded({
			verify: saveRawBody,
			extended: true,
		}),
	);
};
