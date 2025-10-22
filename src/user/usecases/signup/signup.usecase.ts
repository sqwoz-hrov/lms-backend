import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { toUserResponseDto, UserResponseDto } from '../../dto/user.dto';
import { UserRepository } from '../../user.repository';

@Injectable()
export class SignupUsecase implements UsecaseInterface {
	private readonly logger = new Logger(SignupUsecase.name);

	constructor(
		private readonly repo: UserRepository,
	) {}

	public async execute({
		name,
		email,
		telegram_username,
	}: {
		name: string;
		email: string;
		telegram_username: string;
	}): Promise<UserResponseDto> {
		const existingUser = await this.repo.findByEmail(email);

		if (existingUser) throw new BadRequestException('Пользователь с таким email уже существует');

		this.logger.log(`Saving subscriber ${email}...`);

		const saveRes = await this.repo.save({
			role: 'subscriber',
			name,
			email,
			telegram_username,
			finished_registration: false,
			is_archived: false,
			is_billable: false,
			subscription_tier_id: null,
			active_until: null,
		});

		if (!saveRes) {
			throw new InternalServerErrorException('Не удалось создать пользователя');
		}

		const user = await this.repo.findByIdWithSubscriptionTier(saveRes.id);

		if (!user) {
			throw new InternalServerErrorException('Не удалось создать пользователя');
		}

		return toUserResponseDto(user);
	}
}
