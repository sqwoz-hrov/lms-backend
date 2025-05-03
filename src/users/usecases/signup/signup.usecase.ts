import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { User, UserRole } from '../../user.entity';
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
	}: {
		role: UserRole;
		name: string;
		email: string;
		telegram_username: string;
	}): Promise<Omit<User, 'telegram_id'> | undefined> {
		const existingUser = await this.repo.findByEmail(email);

		if (existingUser) throw new BadRequestException('Пользователь с таким email уже существует');

		this.logger.log(`Saving user ${email}...`);

		const saveRes = await this.repo.save({
			role,
			name,
			email,
			telegram_username,
		});
		return saveRes
			? {
					name: saveRes.name,
					id: saveRes.id,
					email: saveRes.email,
					role: saveRes.role,
					telegram_username: saveRes.telegram_username,
				}
			: undefined;
	}
}
