import { BadRequestException, Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { User } from '../../../user/user.entity';
import { GiftGroupedByStatusPage, GiftWithUserSubscriptionTierAndStatus } from '../../gift.entity';
import { GiftRepository } from '../../gift.repository';
import { GetGiftsDto } from '../../dto/get-gifts.dto';
import { GetGiftsResponseDto, GiftListItemDto } from '../../dto/get-gifts-response.dto';

@Injectable()
export class GetGiftsUsecase implements UsecaseInterface {
	constructor(private readonly giftRepository: GiftRepository) {}

	async execute(params: { user: Pick<User, 'id' | 'role'>; query: GetGiftsDto }): Promise<GetGiftsResponseDto> {
		if (params.user.role !== 'admin' && this.hasSearchParams(params.query)) {
			throw new BadRequestException();
		}

		const pagination = {
			page: params.query.page,
			pageSize: params.query.pageSize,
		};
		const groupedGifts =
			params.user.role === 'admin'
				? await this.giftRepository.findGiftedByUserGroupedWithTier(
						params.user,
						{ email: params.query.email },
						pagination,
					)
				: await this.giftRepository.findGiftedToUserGroupedWithTier(params.user, pagination);

		return this.mapGroupedGifts(groupedGifts);
	}

	private hasSearchParams(query: GetGiftsDto): boolean {
		return query.email !== undefined;
	}

	private mapGroupedGifts(gifts: GiftGroupedByStatusPage): GetGiftsResponseDto {
		return {
			currentlyActive: gifts.currentlyActive.map(gift => this.mapGift(gift)),
			used: gifts.used.map(gift => this.mapGift(gift)),
			available: gifts.available.map(gift => this.mapGift(gift)),
			pagination: gifts.pagination,
		};
	}

	private mapGift(gift: GiftWithUserSubscriptionTierAndStatus): GiftListItemDto {
		return {
			id: gift.id,
			giftedTo: gift.gifted_to,
			giftedBy: gift.gifted_by,
			tierId: gift.tier_id,
			activatedAt: gift.activated_at?.toISOString() ?? null,
			durationDays: gift.duration_days,
			expiresAt: gift.expires_at?.toISOString() ?? null,
			user: {
				name: gift.name,
				email: gift.email,
				telegramUsername: gift.telegram_username,
			},
			tier: {
				id: gift.tier.id,
				tier: gift.tier.tier,
				power: gift.tier.power,
				permissions: gift.tier.permissions,
				priceRubles: gift.tier.price_rubles,
			},
		};
	}
}
