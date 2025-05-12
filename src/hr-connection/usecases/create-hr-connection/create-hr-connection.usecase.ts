import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { HrConnectionRepository } from '../../hr-connection.repository';
import { CreateHrConnectionDto } from '../../dto/create-hr-connection.dto';
import { BaseHrConnectionDto } from '../../dto/base-hr-connection.dto';
import { User } from '../../../user/user.entity';
import { UserRepository } from '../../../user/user.repository';

@Injectable()
export class CreateHrConnectionUsecase implements UsecaseInterface {
	constructor(
		private readonly hrRepository: HrConnectionRepository,
		private readonly userRepository: UserRepository,
	) {}

	async execute({ params, user }: { params: CreateHrConnectionDto; user: User }): Promise<BaseHrConnectionDto> {
		if (user.role === 'user') {
			params.student_user_id = user.id;
		}
		if (user.role === 'admin') {
			const existingUser = await this.userRepository.findById(params.student_user_id);
			if (!existingUser) throw new NotFoundException('User not found');
		}
		const record = await this.hrRepository.save(params);
		return record;
	}
}
