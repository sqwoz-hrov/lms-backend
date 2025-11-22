import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubjectResponseDto } from '../../dto/base-subject.dto';
import { SubjectRepository } from '../../subject.repository';
import { UserWithSubscriptionTier } from '../../../user/user.entity';

@Injectable()
export class GetSubjectsUsecase implements UsecaseInterface {
	constructor(private readonly subjectRepository: SubjectRepository) {}

	async execute(user: UserWithSubscriptionTier): Promise<SubjectResponseDto[]> {
		const filters: { subscription_tier_id?: string } = {};

		if (user.role === 'subscriber') {
			const subscriptionTierId = user.subscription.subscription_tier_id;

			if (!subscriptionTierId) {
				return [];
			}

			filters.subscription_tier_id = subscriptionTierId;
		}

		return await this.subjectRepository.find(filters);
	}
}
