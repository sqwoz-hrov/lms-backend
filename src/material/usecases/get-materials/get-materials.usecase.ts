import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { MaterialResponseDto } from '../../dto/material-response.dto';
import { GetMaterialsDto } from '../../dto/get-materials.dto';
import { MaterialRepository } from '../../material.repository';

@Injectable()
export class GetMaterialsUsecase implements UsecaseInterface {
	constructor(private readonly materialRepository: MaterialRepository) {}

	async execute({
		user,
		params,
	}: {
		user: UserWithSubscriptionTier;
		params: GetMaterialsDto;
	}): Promise<MaterialResponseDto[]> {
		const filters: {
			subject_id?: string;
			student_user_id?: string;
			is_archived?: boolean;
		} = {
			subject_id: params.subject_id,
			student_user_id: params.student_user_id ?? undefined,
			is_archived: params.is_archived,
		};

		if (user.role === 'user') {
			filters.student_user_id = user.id;
			filters.is_archived = false;
		}

		const isSubscriber = user.role === 'subscriber';
		let subscriptionTierId: string | undefined;

		if (isSubscriber) {
			subscriptionTierId = user.subscription?.subscription_tier_id ?? undefined;
			filters.is_archived = false;
			delete filters.student_user_id;

			if (!subscriptionTierId) {
				return [];
			}
		}

		return this.materialRepository.find({ ...filters, subscription_tier_id: subscriptionTierId });
	}
}
