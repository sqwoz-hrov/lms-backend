import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubjectResponseDto } from '../../dto/base-subject.dto';
import { SubjectRepository } from '../../subject.repository';
import { UserWithSubscriptionTier } from '../../../user/user.entity';

@Injectable()
export class GetSubjectsUsecase implements UsecaseInterface {
	constructor(private readonly subjectRepository: SubjectRepository) {}

	async execute(user: UserWithSubscriptionTier): Promise<SubjectResponseDto[]> {
		const filters: { current_tier_power?: number } = {};

		if (user.role === 'subscriber') {
			const subscriptionTierPower = user.subscription_tier?.power;

			if (subscriptionTierPower === undefined) {
				return [];
			}

			filters.current_tier_power = subscriptionTierPower;
		}

		return await this.subjectRepository.find(filters);
	}
}
