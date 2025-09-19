import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { UserRepository } from '../../user.repository';
import { UserResponseDto } from '../../dto/signup.dto';

@Injectable()
export class GetUsersUsecase implements UsecaseInterface {
	constructor(private readonly userRepository: UserRepository) {}

	async execute(): Promise<UserResponseDto[]> {
		return this.userRepository.findAll();
	}
}
