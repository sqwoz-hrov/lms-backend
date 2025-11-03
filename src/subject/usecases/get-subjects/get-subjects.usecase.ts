import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubjectResponseDto } from '../../dto/base-subject.dto';
import { SubjectRepository } from '../../subject.repository';
import { UserWithSubscriptionTier } from '../../../user/user.entity';

@Injectable()
export class GetSubjectsUsecase implements UsecaseInterface {
	constructor(private readonly subjectRepository: SubjectRepository) {}

	async execute(user: UserWithSubscriptionTier): Promise<SubjectResponseDto[]> {
		if (user.role === 'subscriber') {
			const subscriptionTierId = user.subscription.subscription_tier_id;

			return await this.subjectRepository.findBySubscriptionTier(subscriptionTierId);
		}

		return await this.subjectRepository.find();
	}
}
