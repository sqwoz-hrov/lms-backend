import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithNullableSubscriptionTier } from '../../../user/user.entity';
import { LimitsResponseDto } from '../../dto/limits-response.dto';
import { LimitsService } from '../../core/limits.service';
import { LimitsRepository } from '../../limits.repository';

@Injectable()
export class GetLimitsUsecase implements UsecaseInterface {
	constructor(
		private readonly limitsService: LimitsService,
		private readonly limitsRepository: LimitsRepository,
	) {}

	async execute({ requester }: { requester: UserWithNullableSubscriptionTier }): Promise<LimitsResponseDto> {
		if (requester.role !== 'subscriber') {
			return {
				applied: [],
				exceeded: [],
			};
		}

		if (!requester.subscription_tier) {
			throw new Error('Subscriber user has no subscription tier');
		}

		const subscriptionTierPower = requester.subscription_tier.power;
		if (subscriptionTierPower > 0) {
			return {
				applied: [],
				exceeded: [],
			};
		}

		const feature = 'interview_transcription' as const;
		const applied = this.limitsService.getAppliedLimitsForUser(feature);

		const usageStats = await this.limitsRepository.getUsageStats({
			feature,
			userId: requester.id,
		});

		const exceeded = this.limitsService.getExceededLimitsForUser(feature, usageStats);

		return {
			applied: applied.map(limit => limit.toPlain()),
			exceeded: exceeded.map(limit => limit.toPlain()),
		};
	}
}
