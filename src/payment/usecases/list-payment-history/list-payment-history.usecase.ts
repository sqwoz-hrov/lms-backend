import { Injectable } from '@nestjs/common';
import { OffsetPaginationInput } from '../../../common/utils/pagination.util';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserWithSubscriptionTier } from '../../../user/user.entity';
import { PaymentHistoryResponseDto, PaymentHistoryItemDto } from '../../dto/payment-history-response.dto';
import { PaymentHistoryRepository } from '../../payment-history.repository';

@Injectable()
export class ListPaymentHistoryUsecase implements UsecaseInterface {
	constructor(private readonly paymentHistoryRepository: PaymentHistoryRepository) {}

	async execute(params: {
		user: UserWithSubscriptionTier;
		pagination: OffsetPaginationInput;
	}): Promise<PaymentHistoryResponseDto> {
		const history = await this.paymentHistoryRepository.findSuccessfulByUserId(params.user.id, params.pagination);

		return {
			items: history.items.map(PaymentHistoryItemDto.fromEntity),
			pagination: history.pagination,
		};
	}
}
