import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserRepository } from '../../user.repository';
import { toUserResponseDto, UserResponseDto } from '../../dto/user.dto';
import { UserWithSubscriptionTier } from '../../user.entity';
import { GetUsersDto } from '../../dto/get-users.dto';

@Injectable()
export class GetUsersUsecase implements UsecaseInterface {
	constructor(private readonly userRepository: UserRepository) {}

	async execute({
		requester,
		filters,
	}: {
		requester: UserWithSubscriptionTier;
		filters?: GetUsersDto;
	}): Promise<UserResponseDto[]> {
		if (requester.role === 'subscriber') {
			const user = await this.userRepository.findByIdWithSubscriptionTier(requester.id);
			if (!user) {
				throw new NotFoundException();
			}
			return [toUserResponseDto(user)];
		}

		const rolesFilter = requester.role === 'admin' ? filters?.roles : undefined;
		const users = await this.userRepository.findAll({
			roles: rolesFilter,
		});

		if (requester.role === 'admin') {
			return users.map(toUserResponseDto);
		}

		return users.filter(user => user.role === 'admin' || user.id === requester.id).map(toUserResponseDto);
	}
}
