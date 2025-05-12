import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { HrConnectionRepository } from '../../hr-connection.repository';
import { DeleteHrConnectionDto } from '../../dto/delete-hr-connection.dto';
import { BaseHrConnectionDto } from '../../dto/base-hr-connection.dto';
import { User } from '../../../user/user.entity';

@Injectable()
export class DeleteHrConnectionUsecase implements UsecaseInterface {
	constructor(private readonly hrRepository: HrConnectionRepository) {}

	async execute({ params, user }: { params: DeleteHrConnectionDto; user: User }): Promise<BaseHrConnectionDto> {
		const existing = await this.hrRepository.findById(params.id);

		if (!existing) {
			throw new NotFoundException('Контакт с HR не найден');
		}

		if (user.role === 'user' && existing.student_user_id !== user.id) {
			throw new UnauthorizedException('Вы не можете удалить этот контакт с HR');
		}

		const deleted = await this.hrRepository.delete(params.id);
		return deleted;
	}
}
