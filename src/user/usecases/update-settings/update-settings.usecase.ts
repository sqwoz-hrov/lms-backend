import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserRepository } from '../../user.repository';
import { UserSettings } from '../../user.entity';

@Injectable()
export class UpdateUserSettingsUsecase implements UsecaseInterface {
	constructor(private readonly userRepository: UserRepository) {}

	public async execute({ userId, settings }: { userId: string; settings: UserSettings }): Promise<UserSettings> {
		return this.userRepository.updateSettings(userId, settings);
	}
}
