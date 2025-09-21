import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const appConfig = registerAs('application', () => ({
	useHttpOnlyCookies: get('USE_HTTP_ONLY_COOKIES').default('true').asBool(),
}));
