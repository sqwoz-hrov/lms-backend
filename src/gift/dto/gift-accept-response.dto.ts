import { ApiProperty } from '@nestjs/swagger';

export type GiftAcceptedResponseType = {
	activateAt: string;
	activeUntil: string;
	giftTierId: string;
};

export class GiftAcceptedResponseDto implements GiftAcceptedResponseType {
	@ApiProperty({
		description: 'Дата и время активации подарочной подписки в ISO формате',
		example: '2024-01-01T00:00:00.000Z',
	})
	activateAt!: string;
	@ApiProperty({
		description: 'Дата и время окончания действия подарочной подписки в ISO формате',
		example: '2024-01-31T23:59:59.000Z',
	})
	activeUntil!: string;
	@ApiProperty({
		description: 'ID уровня подарочной подписки',
		example: 'tier_12345',
	})
	giftTierId!: string;
}
