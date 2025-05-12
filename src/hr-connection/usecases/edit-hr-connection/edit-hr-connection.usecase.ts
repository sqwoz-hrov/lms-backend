import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { HrConnectionRepository } from '../../hr-connection.repository';
import { UpdateHrConnectionDto } from '../../dto/update-hr-connection.dto';
import { BaseHrConnectionDto } from '../../dto/base-hr-connection.dto';
import { User } from '../../../user/user.entity';
import { UserRepository } from '../../../user/user.repository';

@Injectable()
export class EditHrConnectionUsecase implements UsecaseInterface {
	constructor(
		private readonly hrRepository: HrConnectionRepository,
		private readonly userRepository: UserRepository,
	) {}

	async execute({ params, user }: { params: UpdateHrConnectionDto; user: User }): Promise<BaseHrConnectionDto> {
		const { id, ...updates } = params;
		const existing = await this.hrRepository.findById(id);

		if (!existing) {
			throw new NotFoundException('Контакт с HR не найден');
		}

		if (user.role === 'user' && user.id !== existing.student_user_id) {
			throw new UnauthorizedException('Вы не можете изменить этот контакт с HR');
		}

		if (user.role === 'admin' && updates.student_user_id) {
			const existingUser = await this.userRepository.findById(updates.student_user_id);
			if (!existingUser) throw new NotFoundException('User not found');
		}

		const updated = await this.hrRepository.update(id, updates);
		return updated;
	}
}
