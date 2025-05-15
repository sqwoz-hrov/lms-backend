import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { InterviewRepository } from '../../interview.repository';
import { HrConnectionRepository } from '../../../hr-connection/hr-connection.repository';
import { GetInterviewsDto } from '../../dto/get-interviews.dto';
import { InterviewResponseDto } from '../../dto/base-interview.dto';
import { User } from '../../../user/user.entity';

@Injectable()
export class GetInterviewsUsecase implements UsecaseInterface {
	constructor(
		private readonly interviewRepository: InterviewRepository,
		private readonly hrConnectionRepository: HrConnectionRepository,
	) {}

	async execute({ params, user }: { params: GetInterviewsDto; user: User }): Promise<InterviewResponseDto[]> {
		if (user.role === 'user' && params.hr_connection_id) {
			const hrConnection = await this.hrConnectionRepository.findById(params.hr_connection_id);
			if (hrConnection?.student_user_id !== user.id) throw new UnauthorizedException('Это не ваш контакт с HR');
		}

		return await this.interviewRepository.find(params, user.role === 'admin' ? undefined : user.id);
	}
}
