import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtService } from '../../../infra/services/jwt.service';
import { UserRepository } from '../../../user/user.repository';

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(
		private readonly jwtService: JwtService,
		private readonly userRepo: UserRepository,
		private readonly reflector: Reflector,
	) {}

	private readonly logger = new Logger(RoleGuard.name);

	private getAccessTokenFromCookies(request: Request): string {
		const token = request.cookies?.['access_token'] as string | undefined;
		if (!token) {
			throw new UnauthorizedException('Missing access token cookie');
		}
		return token;
	}

	async canActivate(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<Request>();

		const token = this.getAccessTokenFromCookies(request);

		const result = await this.jwtService.verify(token);

		if (!result.success) {
			throw new UnauthorizedException('Invalid or expired access token');
		}

		if (result.data.type !== 'access') {
			throw new UnauthorizedException('Refresh token cannot be used for access');
		}

		const user = await this.userRepo.findByIdWithSubscriptionTier(result.data.userId);

		if (!user) {
			throw new UnauthorizedException('User not found');
		}

		if (!user.finished_registration) {
			throw new UnauthorizedException('Registration not finished');
		}

		if (user.role === 'subscriber' && !user.subscription) {
			this.logger.error('fatal user has no subscription', { userId: user.id });
			throw new UnauthorizedException('Subscriber has no subscription');
		}

		request['user'] = user;

		const allowedRoles = this.reflector.getAllAndOverride<string[]>('roles', [
			context.getHandler(),
			context.getClass(),
		]);

		if (!allowedRoles || !allowedRoles.includes(user.role)) {
			throw new UnauthorizedException('Access denied: role not allowed');
		}

		return true;
	}
}
