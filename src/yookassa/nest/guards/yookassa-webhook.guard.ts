import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as ipaddr from 'ipaddr.js';

/*
from https://yookassa.ru/developers/using-api/webhooks#notifications-authenticity-verify
185.71.76.0/27
185.71.77.0/27
77.75.153.0/25
77.75.156.11
77.75.156.35
77.75.154.128/25
2a02:5180::/32
 */
const YOOKASSA_NETWORKS = [
	'185.71.76.0/27',
	'185.71.77.0/27',
	'77.75.153.0/25',
	'77.75.156.11/32',
	'77.75.156.35/32',
	'77.75.154.128/25',
	'2a02:5180::/32',
] as const;

const parsedYookassaNetworks = YOOKASSA_NETWORKS.map(cidr => ipaddr.parseCIDR(cidr));

@Injectable()
export class YookassaWebhookGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request>();

		if (!this.isYookassaAddress(this.getClientAddress(request))) {
			throw new UnauthorizedException('Webhook sender is not YooKassa');
		}

		return true;
	}

	private getClientAddress(request: Request): string | undefined {
		const forwardedFor = request.headers['x-forwarded-for'];
		const forwardedAddresses = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
			?.split(',')
			.map(value => value.trim())
			.filter(Boolean);
		// Traefik is the only ingress hop in production, so its appended (right-most) address is authoritative.
		const forwardedAddress = forwardedAddresses?.at(-1);
		return forwardedAddress || request.ip || request.socket.remoteAddress;
	}

	private isYookassaAddress(rawAddress: string | undefined): boolean {
		if (!rawAddress || !ipaddr.isValid(rawAddress)) return false;

		const address = ipaddr.process(rawAddress);

		return parsedYookassaNetworks.some(([network, prefix]) => {
			if (address instanceof ipaddr.IPv4 && network instanceof ipaddr.IPv4) {
				return address.match(network, prefix);
			}
			if (address instanceof ipaddr.IPv6 && network instanceof ipaddr.IPv6) {
				return address.match(network, prefix);
			}
			return false;
		});
	}
}
