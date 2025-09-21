import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { JwtService } from '../../../infra/services/jwt.service';
import { UserAggregation } from '../../../user/user.entity';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(
		private readonly jwtService: JwtService,
		private readonly databaseProvider: DatabaseProvider,
		private readonly reflector: Reflector,
	) {}

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

		const conn = this.databaseProvider.getDatabase<UserAggregation>();
		const user = await conn.selectFrom('user').selectAll().where('id', '=', result.data.userId).executeTakeFirst();

		if (!user) {
			throw new UnauthorizedException('User not found');
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
