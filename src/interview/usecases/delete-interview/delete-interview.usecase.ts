import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { InterviewRepository } from '../../interview.repository';
import { DeleteInterviewDto } from '../../dto/delete-interview.dto';
import { InterviewResponseDto } from '../../dto/base-interview.dto';
import { User } from '../../../user/user.entity';
import { HrConnectionRepository } from '../../../hr-connection/hr-connection.repository';

@Injectable()
export class DeleteInterviewUsecase implements UsecaseInterface {
	constructor(
		private readonly interviewRepository: InterviewRepository,
		private readonly hrConnectionRepository: HrConnectionRepository,
	) {}

	async execute({ params, user }: { params: DeleteInterviewDto; user: User }): Promise<InterviewResponseDto> {
		const interview = await this.interviewRepository.findById(params.id);

		if (!interview) {
			throw new NotFoundException('Интервью не найдено');
		}

		const hrConnection = await this.hrConnectionRepository.findById(interview.hr_connection_id);

		if (!hrConnection) {
			throw new NotFoundException('Контакт с HR для интервью не найден');
		}

		if (user.role === 'user' && hrConnection.student_user_id !== user.id) {
			throw new UnauthorizedException('Вы не можете удалить это интервью');
		}

		const deleted = await this.interviewRepository.delete(params.id);
		return deleted;
	}
}
