import { CookieJar, Cookie } from 'tough-cookie';
import { JwtFactory } from './test.jwt.factory';
import { jwtConfig } from '../src/config';
import { ConfigType } from '@nestjs/config';
import { UserMeta } from './test.abstract.sdk';
import * as FormData from 'form-data';
import { Readable } from 'stream';

const getRandomJwt = () => {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(
		JSON.stringify({
			userId: Math.random().toString(36).substring(7),
			type: 'access',
			iat: Math.floor(Date.now() / 1000),
		}),
	).toString('base64url');
	const signature = Buffer.from('invalid-signature').toString('base64url');
	return `${header}.${payload}.${signature}`;
};

type RequestBody = Record<string, any> | FormData | Buffer | Readable | string;

interface RequestOptions {
	path: string;
	body?: RequestBody;
	headers?: Record<string, any>;
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	userMeta: UserMeta;
}
type SuccessStatus = 200 | 201 | 202 | 203 | 205 | 206 | 207 | 208 | 226;
type ErrorStatus = 400 | 401 | 402 | 403 | 404 | 500;

type RequestResultOk<TResponse> = {
	status: SuccessStatus;
	body: TResponse;
	headers: Headers;
	cookies: string[];
};

type RequestResultErr = {
	status: ErrorStatus;
	body: { description: string };
	headers: Headers;
	cookies: string[];
};

type NonJsonResult = {
	status: 204;
	body: Record<string, never>;
	headers: Headers;
	cookies: string[];
};

export type RequestResult<TResponse> = RequestResultOk<TResponse> | RequestResultErr | NonJsonResult;

export class TestHttpClient {
	private readonly jwtFactory: JwtFactory;
	private readonly cookieJar = new CookieJar();
	private readonly baseUrl: string;

	constructor(config: { port: number | undefined; host: string }, jwtOptions: ConfigType<typeof jwtConfig>) {
		this.jwtFactory = new JwtFactory(jwtOptions);
		this.baseUrl = `${config.host}${config.port ? `:${config.port}` : ''}`;
	}

	public setCookies(cookies: string[]) {
		for (const cookie of cookies) {
			this.cookieJar.setCookieSync(cookie, this.baseUrl);
		}
	}

	public clearCookies() {
		this.cookieJar.removeAllCookiesSync();
	}

	public async request<TResponse = any>({
		path,
		body,
		headers = {},
		method,
		userMeta,
	}: RequestOptions): Promise<RequestResult<TResponse>> {
		const url = `${this.baseUrl}${path}`;
		const authCookie = this.buildAuthCookie(userMeta);
		const { processedBody, contentHeaders } = this.processBody(body);

		const finalHeaders = this.buildHeaders({
			authCookie,
			contentHeaders,
			customHeaders: headers,
		});

		const response = await fetch(url, {
			method,
			body: processedBody as BodyInit,
			headers: finalHeaders,
		});

		const setCookieHeaders = response.headers.getSetCookie();
		if (setCookieHeaders.length > 0) {
			this.setCookies(setCookieHeaders);
		}

		const parsedBody = await this.parseResponseBody<TResponse>(response);

		return {
			status: response.status,
			body: parsedBody,
			headers: response.headers,
			cookies: setCookieHeaders,
		} as RequestResult<TResponse>;
	}

	private buildAuthCookie(userMeta: UserMeta): string | null {
		const { userId, isAuth, isWrongAccessJwt, isWrongRefreshJwt } = userMeta;

		if (!isAuth) {
			return null;
		}

		const { accessToken, refreshToken } = this.jwtFactory.getJwtPair(userId);
		const effectiveRefreshOverride = isWrongRefreshJwt ?? isWrongAccessJwt;

		const cookies = [
			new Cookie({
				key: 'access_token',
				value: isWrongAccessJwt ? getRandomJwt() : accessToken,
			}),
			new Cookie({
				key: 'refresh_token',
				value: effectiveRefreshOverride ? getRandomJwt() : refreshToken,
			}),
		];

		return cookies.map(c => `${c.key}=${c.value}`).join('; ');
	}

	private processBody(body?: RequestBody) {
		if (!body) {
			return { processedBody: undefined, contentHeaders: {} };
		}

		// Handle FormData (Node.js form-data package)
		if (body instanceof FormData) {
			return {
				processedBody: body.getBuffer(),
				contentHeaders: body.getHeaders(),
			};
		}

		// Handle Buffer
		if (Buffer.isBuffer(body)) {
			return {
				processedBody: body,
				contentHeaders: {
					'Content-Type': 'application/octet-stream',
					'Content-Length': String(body.length),
				},
			};
		}

		// Handle Readable streams
		if (body instanceof Readable) {
			return {
				processedBody: body,
				contentHeaders: {
					'Content-Type': 'application/octet-stream',
				},
			};
		}

		// Handle string
		if (typeof body === 'string') {
			return {
				processedBody: body,
				contentHeaders: {
					'Content-Type': 'text/plain',
				},
			};
		}

		// Handle plain objects (JSON)
		return {
			processedBody: JSON.stringify(body),
			contentHeaders: {
				'Content-Type': 'application/json',
			},
		};
	}

	private buildHeaders({
		authCookie,
		contentHeaders,
		customHeaders,
	}: {
		authCookie: string | null;
		contentHeaders: Record<string, string | undefined>;
		customHeaders: Record<string, any>;
	}): Record<string, string> {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			...contentHeaders,
		};

		if (authCookie) {
			headers.Cookie = authCookie;
		}

		// Custom headers override everything (including content-type if needed)
		for (const [key, value] of Object.entries(customHeaders)) {
			if (value !== undefined && value !== null) {
				headers[key] = String(value);
			}
		}

		return headers;
	}

	private async parseResponseBody<TResponse>(
		response: Response,
	): Promise<TResponse | { description: string } | Record<string, never>> {
		const contentType = response.headers.get('content-type') || '';

		// If no content or 204 No Content, return empty object
		if (response.status === 204 || !contentType) {
			return {} as Record<string, never>;
		}

		// Parse JSON responses
		if (contentType.includes('application/json')) {
			return (await response.json()) as TResponse;
		}

		// For non-JSON responses, try to parse anyway (for compatibility)
		try {
			return (await response.json()) as TResponse;
		} catch {
			return {} as Record<string, never>;
		}
	}
}
