import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const appConfig = registerAs('application', () => ({
	useSecureCookies: get('USE_SECURE_COOKIES').default('true').asBool(),
}));
