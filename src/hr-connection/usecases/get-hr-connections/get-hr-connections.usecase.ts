import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { HrConnectionRepository } from '../../hr-connection.repository';
import { BaseHrConnectionDto } from '../../dto/base-hr-connection.dto';
import { GetHrConnectionsDto } from '../../dto/get-hr-connections.dto';
import { User } from '../../../user/user.entity';

@Injectable()
export class GetHrConnectionsUsecase implements UsecaseInterface {
	constructor(private readonly hrRepository: HrConnectionRepository) {}

	async execute({ params, user }: { params: GetHrConnectionsDto; user: User }): Promise<BaseHrConnectionDto[]> {
		if (user.role === 'user') {
			params.student_user_id = user.id;
		}

		return await this.hrRepository.find(params);
	}
}
