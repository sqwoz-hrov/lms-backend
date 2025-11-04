import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { DeleteSubscriptionTierDto } from '../../dto/delete-subscription-tier.dto';
import { SubscriptionTierResponseDto } from '../../dto/base-subscription-tier.dto';
import { SubscriptionTierRepository } from '../../subscription-tier.repository';

@Injectable()
export class DeleteSubscriptionTierUsecase implements UsecaseInterface {
	constructor(private readonly subscriptionTierRepository: SubscriptionTierRepository) {}

	async execute(dto: DeleteSubscriptionTierDto): Promise<SubscriptionTierResponseDto> {
		const existing = await this.subscriptionTierRepository.findById(dto.id);

		if (!existing) {
			throw new NotFoundException('Тариф подписки не найден');
		}

		const deleted = await this.subscriptionTierRepository.delete(dto.id);

		return deleted;
	}
}
