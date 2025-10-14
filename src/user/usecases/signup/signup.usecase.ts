import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { toUserResponseDto, UserResponseDto } from '../../dto/user.dto';
import { UserRole } from '../../user.entity';
import { UserRepository } from '../../user.repository';

@Injectable()
export class SignupUsecase implements UsecaseInterface {
	private readonly logger = new Logger(SignupUsecase.name);

	constructor(private readonly repo: UserRepository) {}

	public async execute({
		role,
		name,
		email,
		telegram_username,
		is_archived,
	}: {
		role: UserRole;
		name: string;
		email: string;
		telegram_username: string;
		is_archived?: boolean;
	}): Promise<UserResponseDto | undefined> {
		const existingUser = await this.repo.findByEmail(email);

		if (existingUser) throw new BadRequestException('Пользователь с таким email уже существует');

		const normalizedIsArchived = is_archived ?? false;

		if (role === 'subscriber') {
			throw new BadRequestException('Нельзя создать подписчика вручную');
		}

		this.logger.log(`Saving user ${email}...`);

		const saveRes = await this.repo.save({
			role,
			name,
			email,
			telegram_username,
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
