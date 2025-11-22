import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubscriptionTierResponseDto } from '../../dto/base-subscription-tier.dto';
import { UpdateSubscriptionTierDto } from '../../dto/update-subscription-tier.dto';
import { SubscriptionTierRepository } from '../../subscription-tier.repository';
import { SubscriptionTierUpdate } from '../../../user/user.entity';

@Injectable()
export class UpdateSubscriptionTierUsecase implements UsecaseInterface {
	constructor(private readonly subscriptionTierRepository: SubscriptionTierRepository) {}

	async execute(dto: UpdateSubscriptionTierDto): Promise<SubscriptionTierResponseDto> {
		const existing = await this.subscriptionTierRepository.findById(dto.id);

		if (!existing) {
			throw new NotFoundException('Тариф подписки не найден');
		}

		const { id, ...updates } = dto;

		const filteredUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
			if (value !== undefined) {
				(acc as Record<string, unknown>)[key] = value;
			}
			return acc;
		}, {} as SubscriptionTierUpdate);

		const updated =
			Object.keys(filteredUpdates).length === 0
				? existing
				: await this.subscriptionTierRepository.update(id, filteredUpdates);

		return {
			...updated,
			permissions: updated.permissions ?? [],
		};
	}
}
