const getRandomJwt = () => {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
	const payload = Buffer.from(
		JSON.stringify({
			sub: Math.random().toString(36).substring(7),
			iat: Math.floor(Date.now() / 1000),
		}),
	).toString('base64');
	const signature = Buffer.from('invalid-signature').toString('base64');

	return `${header}.${payload}.${signature}`;
};

export class TestHttpClient {
	constructor(private readonly config: { port: number | undefined; host: string }) {}

	public name() {}

	public async request<TResponse>({
		path,
		body,
		jwt,
		wrongJwt,
		method,
	}: {
		path: string;
		body: unknown;
		jwt: string | undefined;
		wrongJwt: boolean | undefined;
		method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	}) {
		const result = await fetch(`${this.config.host}:${this.config.port}/${path}`, {
			method,
			...(body ? { body: JSON.stringify(body) } : {}),
			headers: {
				'Content-Type': 'application/json',
				...(jwt ? { Authorization: `Bearer ${wrongJwt ? getRandomJwt() : jwt}` } : {}),
			},
		});

		return {
			status: result.status,
			body: (await result.json()) as TResponse,
		};
	}
}
