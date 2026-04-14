import {
	BadRequestException,
	CallHandler,
	ExecutionContext,
	HttpException,
	Injectable,
	NestInterceptor,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { RequestWithUser } from '../common/interface/request-with-user.interface';
import { LIMITABLE_RESOURCES, LimitableResource } from './core/limits.domain';
import { LimitsService } from './core/limits.service';
import { LIMIT_FEATURE_METADATA_KEY } from './common/limits.decorator';
import { LimitsRepository } from './limits.repository';

@Injectable()
export class LimitsInterceptor implements NestInterceptor {
	constructor(
		private readonly reflector: Reflector,
		private readonly limitsService: LimitsService,
		private readonly limitsRepository: LimitsRepository,
	) {}

	public async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
		const request = context.switchToHttp().getRequest<RequestWithUser>();
		const method = (request.method ?? '').toUpperCase();

		if (method !== 'POST' && method !== 'PATCH') {
			throw new BadRequestException('LimitsInterceptor can only be used on POST/PATCH handlers');
		}

		const feature = this.reflector.getAllAndOverride<LimitableResource>(LIMIT_FEATURE_METADATA_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!feature || LIMITABLE_RESOURCES.includes(feature) === false) {
			throw new BadRequestException('Limited feature is not configured for route');
		}

		const { user } = request;

		if (!user) {
			throw new UnauthorizedException('Authenticated user is required for limits interceptor');
		}

		if (user.role !== 'subscriber') {
			return next.handle();
		}

		if (!user.subscription_tier) {
			throw new UnauthorizedException('Subscriber has no subscription tier');
		}

		if (user.subscription_tier.power > 0) {
			return next.handle();
		}

		await this.limitsRepository.transaction(async trx => {
			const usageStats = await this.limitsRepository.getUsageStats(
				{ feature, userId: user.id },
				trx,
			);

			const exceeded = this.limitsService.getExceededLimitsForUser(feature, usageStats);
			if (exceeded.length > 0) {
				const exceededNames = exceeded.map(limit => limit.getName()).join(', ');
				throw new HttpException({
					message: `AI usage limit exceeded: ${exceededNames}`,
				}, 429);
			}

			await this.limitsRepository.recordUsage({ feature, userId: user.id }, trx);
		});

		return next.handle();
	}
}
