import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubjectResponseDto } from '../../dto/base-subject.dto';
import { SubjectRepository } from '../../subject.repository';
import { User } from '../../../user/user.entity';

@Injectable()
export class GetSubjectsUsecase implements UsecaseInterface {
	constructor(private readonly subjectRepository: SubjectRepository) {}

	async execute(user: User): Promise<SubjectResponseDto[]> {
		if (user.role === 'subscriber') {
			if (!user.subscription_tier_id) {
				return [];
			}

			return await this.subjectRepository.findBySubscriptionTier(user.subscription_tier_id);
		}

		return await this.subjectRepository.find();
	}
}
