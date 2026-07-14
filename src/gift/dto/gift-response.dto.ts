import { ApiProperty } from '@nestjs/swagger';

export class GiftSubscriptionResponseDto {
	@ApiProperty({ format: 'uuid', description: 'Идентификатор пользователя, которому выдается подписка' })
	giftToUserId!: string;

	@ApiProperty({ description: 'Имя пользователя, которому выдается подписка' })
	giftedToUsername!: string;

	@ApiProperty({
		format: 'email',
		description: 'Email пользователя, которому выдается подписка',
	})
	giftedToEmail!: string;

	@ApiProperty({
		description: 'Название тарифа подписки',
	})
	subscriptionTierName!: string;

	@ApiProperty({
		description: 'Длительность подарка в днях',
		minimum: 1,
		maximum: 365,
		example: 30,
	})
	durationDays!: number;
}
