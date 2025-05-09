import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubjectResponseDto } from '../../dto/base-subject.dto';
import { SubjectRepository } from '../../subject.repository';

@Injectable()
export class GetSubjectsUsecase implements UsecaseInterface {
	constructor(private readonly subjectRepository: SubjectRepository) {}

	async execute(): Promise<SubjectResponseDto[]> {
		return await this.subjectRepository.find();
	}
}
