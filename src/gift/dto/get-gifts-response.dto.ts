import { ApiProperty } from '@nestjs/swagger';

class GiftListUserDto {
	@ApiProperty()
	name!: string;

	@ApiProperty()
	email!: string;

	@ApiProperty()
	telegramUsername!: string;
}

class GiftListTierDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	tier!: string;

	@ApiProperty()
	power!: number;

	@ApiProperty({ type: [String] })
	permissions!: string[];

	@ApiProperty()
	priceRubles!: number;
}

export class GiftListItemDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	giftedTo!: string;

	@ApiProperty()
	giftedBy!: string;

	@ApiProperty()
	tierId!: string;

	@ApiProperty({ nullable: true })
	activatedAt!: string | null;

	@ApiProperty()
	durationDays!: number;

	@ApiProperty({ nullable: true })
	expiresAt!: string | null;

	@ApiProperty({ type: GiftListUserDto })
	user!: GiftListUserDto;

	@ApiProperty({ type: GiftListTierDto })
	tier!: GiftListTierDto;
}

class GiftListPaginationDto {
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

export class GetGiftsResponseDto {
	@ApiProperty({ type: [GiftListItemDto] })
	currentlyActive!: GiftListItemDto[];

	@ApiProperty({ type: [GiftListItemDto] })
	used!: GiftListItemDto[];

	@ApiProperty({ type: [GiftListItemDto] })
	available!: GiftListItemDto[];

	@ApiProperty({ type: GiftListPaginationDto })
	pagination!: GiftListPaginationDto;
}
