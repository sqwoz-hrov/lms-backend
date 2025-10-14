import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { User } from '../../../user/user.entity';
import { MaterialResponseDto } from '../../dto/base-material.dto';
import { GetMaterialsDto } from '../../dto/get-materials.dto';
import { MaterialRepository } from '../../material.repository';

@Injectable()
export class GetMaterialsUsecase implements UsecaseInterface {
	constructor(private readonly materialRepository: MaterialRepository) {}

	async execute({ user, params }: { user: User; params: GetMaterialsDto }): Promise<MaterialResponseDto[]> {
		const filters: {
			subject_id?: string;
			student_user_id?: string;
			is_archived?: boolean;
		} = { ...params };

		if (user.role === 'user') {
			filters.student_user_id = user.id;
			delete filters.is_archived;
		}

		let subscriptionTierId: string | undefined;

		if (user.role === 'subscriber') {
			subscriptionTierId = user.subscription_tier_id ?? undefined;
			delete filters.is_archived;
			delete filters.student_user_id;

			if (!subscriptionTierId) {
				return [];
			}
		}

		return this.materialRepository.find({ ...filters, subscription_tier_id: subscriptionTierId });
	}
}
