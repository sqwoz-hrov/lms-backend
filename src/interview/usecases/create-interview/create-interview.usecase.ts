import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { CreateInterviewDto } from '../../dto/create-interview.dto';
import { InterviewRepository } from '../../interview.repository';
import { HrConnectionRepository } from '../../../hr-connection/hr-connection.repository';
import { InterviewResponseDto } from '../../dto/base-interview.dto';
import { User } from '../../../user/user.entity';

@Injectable()
export class CreateInterviewUsecase implements UsecaseInterface {
	constructor(
		private readonly interviewRepository: InterviewRepository,
		private readonly hrConnectionRepository: HrConnectionRepository,
	) {}

	async execute({ params, user }: { params: CreateInterviewDto; user: User }): Promise<InterviewResponseDto> {
		const hrConnection = await this.hrConnectionRepository.findById(params.hr_connection_id);
		if (!hrConnection) {
			throw new NotFoundException('Контакт с HR не найден');
		}

		if (user.role === 'user' && hrConnection.student_user_id !== user.id) {
			throw new ForbiddenException('Вы не можете добавлять интервью для этого контакта с HR');
		}

		const record = await this.interviewRepository.save(params);
		return record;
	}
}
