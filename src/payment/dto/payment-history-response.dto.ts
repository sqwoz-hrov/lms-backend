import { ApiProperty } from '@nestjs/swagger';
import { parseAmount } from '../payment.utils';
import { PaginatedPaymentHistory } from '../payment-history.repository';

export class PaymentHistoryItemDto {
	@ApiProperty()
	paymentMethodName!: string;

	@ApiProperty()
	amount!: number;

	@ApiProperty()
	currency!: 'RUB';

	@ApiProperty()
	date!: string;

	static fromEntity(entity: PaginatedPaymentHistory['items'][number]): PaymentHistoryItemDto {
		const dto = new PaymentHistoryItemDto();
		dto.paymentMethodName = entity.payment_method;
		dto.amount = parseAmount(entity.event.object.amount.value);
		dto.currency = entity.event.object.amount.currency;
		dto.date = entity.created_at.toISOString();
		return dto;
	}
}

class PaymentHistoryPaginationDto {
	@ApiProperty()
	page!: number;

	@ApiProperty()
	pageSize!: number;

	@ApiProperty()
	totalItems!: number;

	@ApiProperty()
	totalPages!: number;

	@ApiProperty()
	hasNextPage!: boolean;

	@ApiProperty()
	hasPreviousPage!: boolean;
}

export class PaymentHistoryResponseDto {
	@ApiProperty({ type: [PaymentHistoryItemDto] })
	items!: PaymentHistoryItemDto[];

	@ApiProperty({ type: PaymentHistoryPaginationDto })
	pagination!: PaymentHistoryPaginationDto;
}
