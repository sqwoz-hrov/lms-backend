import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { expect } from 'chai';
import { Request } from 'express';
import { YookassaWebhookGuard } from './yookassa-webhook.guard';

describe('YookassaWebhookGuard', () => {
	const payload = () => ({
		event: 'payment_method.active',
		object: { id: 'method-id', type: 'bank_card', status: 'active', saved: true },
	});

	it('does not skip the sender IP check client from localhost', () => {
		const guard = new YookassaWebhookGuard();
		expect(() => guard.canActivate(contextFor(payload(), '127.0.0.1'))).to.throw(UnauthorizedException);
	});

	it('does not skip the sender IP check client from localhost 2', () => {
		const guard = new YookassaWebhookGuard();
		expect(() => guard.canActivate(contextFor(payload(), '0.0.0.0'))).to.throw(UnauthorizedException);
	});

	it('accepts current YooKassa IPv4 and IPv6 ranges for the real client', () => {
		const guard = new YookassaWebhookGuard();
		expect(guard.canActivate(contextFor(payload(), '185.71.76.12'))).to.equal(true);
		expect(guard.canActivate(contextFor(payload(), '2a02:5180::10'))).to.equal(true);
	});

	it("rejects non-YooKassa senders and uses Traefik's right-most forwarded address", () => {
		const guard = new YookassaWebhookGuard();
		expect(() => guard.canActivate(contextFor(payload(), '203.0.113.4'))).to.throw(UnauthorizedException);
		expect(() => guard.canActivate(contextFor(payload(), '185.71.76.12, 203.0.113.4'))).to.throw(UnauthorizedException);
	});
});

const contextFor = (body: unknown, forwardedFor: string): ExecutionContext =>
	({
		switchToHttp: () => ({
			getRequest: () =>
				({
					body,
					headers: { 'x-forwarded-for': forwardedFor },
					socket: {},
				}) as unknown as Request,
		}),
	}) as ExecutionContext;
