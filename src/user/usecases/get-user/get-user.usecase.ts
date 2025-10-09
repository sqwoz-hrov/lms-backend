import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserRepository } from '../../user.repository';
import { UserResponseDto } from '../../dto/signup.dto';
import { User } from '../../user.entity';

@Injectable()
export class GetUserUsecase implements UsecaseInterface {
	constructor(private readonly userRepository: UserRepository) {}

	async execute({ id, requester }: { id: string; requester: User }): Promise<UserResponseDto> {
		const user = await this.userRepository.findById(id);

		if (!user) {
			throw new NotFoundException('Пользователь не найден');
		}

		const isRequesterAdmin = requester.role === 'admin';
		const isSelf = requester.id === id;
		const isTargetAdmin = user.role === 'admin';

		if (!isRequesterAdmin && !isSelf && !isTargetAdmin) {
			throw new UnauthorizedException('Недостаточно прав для просмотра пользователя');
		}

		return user;
	}
}
