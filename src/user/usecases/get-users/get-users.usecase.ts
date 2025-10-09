import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserRepository } from '../../user.repository';
import { UserResponseDto } from '../../dto/signup.dto';
import { User } from '../../user.entity';

@Injectable()
export class GetUsersUsecase implements UsecaseInterface {
	constructor(private readonly userRepository: UserRepository) {}

	async execute({ requester }: { requester: User }): Promise<UserResponseDto[]> {
		const users = await this.userRepository.findAll();

		if (requester.role === 'admin') {
			return users;
		}

		return users.filter(user => user.role === 'admin' || user.id === requester.id);
	}
}
