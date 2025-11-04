import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { CreateSubscriptionTierDto } from '../../dto/create-subscription-tier.dto';
import { SubscriptionTierResponseDto } from '../../dto/base-subscription-tier.dto';
import { SubscriptionTierRepository } from '../../subscription-tier.repository';

@Injectable()
export class CreateSubscriptionTierUsecase implements UsecaseInterface {
	constructor(private readonly subscriptionTierRepository: SubscriptionTierRepository) {}

	async execute(dto: CreateSubscriptionTierDto): Promise<SubscriptionTierResponseDto> {
		const created = await this.subscriptionTierRepository.create(dto);

		return created;
	}
}
