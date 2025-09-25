import { CookieJar, Cookie } from 'tough-cookie';
import { JwtFactory } from './test.jwt.factory';
import { jwtConfig } from '../src/config';
import { ConfigType } from '@nestjs/config';
import { UserMeta } from './test.abstract.sdk';
import { fetch, FormData } from 'undici';

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

export class TestHttpClient {
	private readonly jwtFactory: JwtFactory;
	private readonly cookieJar = new CookieJar();

	constructor(
		private readonly config: { port: number | undefined; host: string },
		jwtOptions: ConfigType<typeof jwtConfig>,
	) {
		this.jwtFactory = new JwtFactory(jwtOptions);
	}

	public setCookies(cookies: string[]) {
		for (const cookie of cookies) {
			this.cookieJar.setCookieSync(cookie, `${this.config.host}:${this.config.port}`);
		}
	}

	public clearCookies() {
		this.cookieJar.removeAllCookiesSync();
	}

	public async request<TResponse>({
		path,
		body,
		method,
		userMeta,
	}: {
		path: string;
		body?: unknown;
		method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
		userMeta: UserMeta;
	}) {
		let cookies: Cookie[] = [];
		const { userId, isAuth, isWrongAccessJwt, isWrongRefreshJwt } = userMeta;
		if (isAuth) {
			const { accessToken, refreshToken } = this.jwtFactory.getJwtPair(userId);

			const effectiveRefreshOverride = isWrongRefreshJwt !== undefined ? isWrongRefreshJwt : isWrongAccessJwt;

			cookies = [
				new Cookie({
					key: 'access_token',
					value: isWrongAccessJwt ? getRandomJwt() : accessToken,
				}),
				new Cookie({
					key: 'refresh_token',
					value: effectiveRefreshOverride ? getRandomJwt() : refreshToken,
				}),
			];
		}

		const cookieHeader = cookies.map(c => `${c.key}=${c.value}`).join('; ');

		const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

		// ВАЖНО: для FormData НЕЛЬЗЯ руками ставить Content-Type — undici сам проставит boundary.
		const headersObject: Record<string, string> = {
			Accept: 'application/json',
			...(isAuth ? { Cookie: cookieHeader } : {}),
			...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
		};

		const result = await fetch(`${this.config.host}:${this.config.port}${path}`, {
			method,
			...(body ? (isFormData ? { body: body } : { body: JSON.stringify(body) }) : {}),
			headers: headersObject,
		});

		const setCookieHeaders = result.headers.getSetCookie();
		if (setCookieHeaders.length > 0) {
			this.setCookies(setCookieHeaders);
		}

		// пробуем распарсить json, если его нет — вернём {}
		let json: TResponse | Record<string, never> = {};
		try {
			json = (await result.json()) as TResponse;
		} catch {
			// ignore
		}

		return {
			status: result.status,
			body: json as TResponse,
			cookies: setCookieHeaders,
		};
	}
}
