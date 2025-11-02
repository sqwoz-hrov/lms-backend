import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubscriptionTierResponseDto } from '../../dto/base-subscription-tier.dto';
import { SubscriptionTierRepository } from '../../subscription-tier.repository';

@Injectable()
export class GetSubscriptionTiersUsecase implements UsecaseInterface {
	constructor(private readonly subscriptionTierRepository: SubscriptionTierRepository) {}

	async execute(): Promise<SubscriptionTierResponseDto[]> {
		return await this.subscriptionTierRepository.findAll();
	}
}
