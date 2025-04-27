import { Injectable, Inject, LoggerService } from '@nestjs/common';

import { UsecaseInterface } from '../../../common/interface';
import { UserRepository } from '../../user.repository';
import { User, UserRole } from '../../user.entity';
import { LOGGER_INSTANCE } from '../../../infra/constants';

@Injectable()
export class SignupUsecase implements UsecaseInterface {
	constructor(
		private readonly repo: UserRepository,
		@Inject(LOGGER_INSTANCE) private readonly logger: LoggerService,
	) {}

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
		try {
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
		} catch (error) {
			this.logger.error(error);
			return undefined;
		}
	}
}
