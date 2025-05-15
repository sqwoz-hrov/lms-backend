import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { InterviewRepository } from '../../interview.repository';
import { HrConnectionRepository } from '../../../hr-connection/hr-connection.repository';
import { UpdateInterviewDto } from '../../dto/update-interview.dto';
import { InterviewResponseDto } from '../../dto/base-interview.dto';
import { User } from '../../../user/user.entity';

@Injectable()
export class EditInterviewUsecase implements UsecaseInterface {
	constructor(
		private readonly interviewRepository: InterviewRepository,
		private readonly hrConnectionRepository: HrConnectionRepository,
	) {}

	async execute({ params, user }: { params: UpdateInterviewDto; user: User }): Promise<InterviewResponseDto> {
		const { id, ...updates } = params;

		const existing = await this.interviewRepository.findById(id);
		if (!existing) {
			throw new NotFoundException('Интервью не найдено');
		}

		const hrConnection = await this.hrConnectionRepository.findById(existing.hr_connection_id);
		if (!hrConnection) {
			throw new NotFoundException('Контакт с HR не найден');
		}

		if (user.role === 'user' && hrConnection.student_user_id !== user.id) {
			throw new UnauthorizedException('Вы не можете изменить это интервью');
		}

		const updated = await this.interviewRepository.update(id, updates);
		return updated;
	}
}
