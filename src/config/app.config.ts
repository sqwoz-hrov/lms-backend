import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const appConfig = registerAs('application', () => ({
	useSecureCookies: get('USE_SECURE_COOKIES').default('true').asBool(),
	cookieDomain: get('COOKIE_DOMAIN').default('').asString() || undefined,
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	sameSite: get('COOKIE_SAME_SITE').required().asEnum(['lax', 'strict', 'none']) as 'lax' | 'strict' | 'none',
}));
