import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserRepository } from '../../user.repository';
import { UserRole } from '../../user.entity';
import { toUserResponseDto, UserResponseDto } from '../../dto/user.dto';

@Injectable()
export class SignupUsecase implements UsecaseInterface {
	private readonly logger = new Logger(SignupUsecase.name);

	constructor(private readonly repo: UserRepository) {}

	public async execute({
		role,
		name,
		email,
		telegram_username,
		subscription_tier_id,
		active_until,
		is_billable,
		is_archived,
	}: {
		role: UserRole;
		name: string;
		email: string;
		telegram_username: string;
		subscription_tier_id?: string | null;
		active_until?: Date | string | null;
		is_billable?: boolean;
		is_archived?: boolean;
	}): Promise<UserResponseDto | undefined> {
		const existingUser = await this.repo.findByEmail(email);

		if (existingUser) throw new BadRequestException('Пользователь с таким email уже существует');

		const normalizedIsArchived = is_archived ?? false;

		const normalizedSubscriptionTierId: string | null = subscription_tier_id ?? null;
		const normalizedIsBillable = is_billable ?? false;
		const normalizedActiveUntil: Date | null = active_until ? new Date(active_until) : null;

		if (normalizedActiveUntil && Number.isNaN(normalizedActiveUntil.getTime())) {
			throw new BadRequestException('Некорректная дата окончания активности');
		}

		if (role === 'subscriber') {
			if (!normalizedSubscriptionTierId) {
				throw new BadRequestException('Подписчику необходимо указать subscription_tier_id');
			}

			if (!normalizedActiveUntil) {
				throw new BadRequestException('Подписчику необходимо указать active_until');
			}

			if (normalizedIsBillable === false) {
				throw new BadRequestException('Подписчик должен быть billable');
			}
		} else {
			if (normalizedIsBillable === true) {
				throw new BadRequestException('Нельзя выставить billable для неподлежающих подписке ролей');
			}
		}

		this.logger.log(`Saving user ${email}...`);

		const saveRes = await this.repo.save({
			role,
			name,
			email,
			telegram_username,
			subscription_tier_id: normalizedSubscriptionTierId,
			active_until: normalizedActiveUntil,
			is_billable: normalizedIsBillable,
			is_archived: normalizedIsArchived,
		});

		if (!saveRes) {
			return undefined;
		}

		const user = await this.repo.findByIdWithSubscriptionTier(saveRes.id);

		if (!user) {
			return undefined;
		}

		return toUserResponseDto(user);
	}
}
