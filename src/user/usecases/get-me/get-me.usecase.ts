import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { User } from '../../user.entity';
import { UserResponseDto, toUserResponseDto } from '../../dto/user.dto';
import { UserRepository } from '../../user.repository';

@Injectable()
export class GetMeUsecase implements UsecaseInterface {
	constructor(private readonly userRepository: UserRepository) {}

	async execute({ user }: { user: User }): Promise<UserResponseDto> {
		const userWithSubscription = await this.userRepository.findByIdWithSubscriptionTier(user.id);

		if (!userWithSubscription) {
			throw new NotFoundException('Пользователь не найден');
		}

		return toUserResponseDto(userWithSubscription);
	}
}
