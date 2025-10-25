import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserRepository } from '../../user.repository';
import { UserResponseDto, toUserResponseDto } from '../../dto/user.dto';
import { UserWithSubscriptionTier } from '../../user.entity';

@Injectable()
export class GetUserUsecase implements UsecaseInterface {
	constructor(private readonly userRepository: UserRepository) {}

	async execute({ id, requester }: { id: string; requester: UserWithSubscriptionTier }): Promise<UserResponseDto> {
		const user = await this.userRepository.findByIdWithSubscriptionTier(id);

		if (!user) {
			throw new NotFoundException('Пользователь не найден');
		}

		const isRequesterAdmin = requester.role === 'admin';
		const isSelf = requester.id === id;
		const isTargetAdmin = user.role === 'admin';

		if (!isRequesterAdmin && !isSelf && !isTargetAdmin) {
			throw new UnauthorizedException('Недостаточно прав для просмотра пользователя');
		}

		return toUserResponseDto(user);
	}
}
