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

	private getTokenFromRequest(request: Request) {
		const authHeader = request?.headers?.authorization;

		if (!authHeader || typeof authHeader !== 'string') {
			throw new UnauthorizedException();
		}
		if (!authHeader.startsWith('Bearer ')) {
			throw new UnauthorizedException();
		}

		const token = authHeader.split(' ').at(1);

		return token;
	}

	async canActivate(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<Request>();

		const token = this.getTokenFromRequest(request);

		if (!token) {
			throw new UnauthorizedException();
		}

		const requestAuthorOrFalse = await this.jwtService.verify(token);

		if (!requestAuthorOrFalse.success) {
			throw new UnauthorizedException();
		}

		const conn = this.databaseProvider.getDatabase<UserAggregation>();

		const user = await conn
			.selectFrom('user')
			.selectAll()
			.where('id', '=', requestAuthorOrFalse.data.userId)
			.executeTakeFirst();

		if (!user) {
			throw new UnauthorizedException();
		}

		request['user'] = user;

		const allowedRoles = this.reflector.getAllAndOverride<string[]>('roles', [
			context.getHandler(),
			context.getClass(),
		]);

		if (!allowedRoles) {
			throw new UnauthorizedException();
		}

		if (!allowedRoles.includes(user.role)) {
			throw new UnauthorizedException();
		}

		return true;
	}
}
