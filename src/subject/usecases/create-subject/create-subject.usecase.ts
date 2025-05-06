import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubjectResponseDto } from '../../dto/base-subject.dto';
import { CreateSubjectDto } from '../../dto/create-subject.dto';
import { SubjectRepository } from '../../subject.repository';

@Injectable()
export class CreateSubjectUsecase implements UsecaseInterface {
	constructor(private readonly subjectRepository: SubjectRepository) {}

	async execute(params: CreateSubjectDto): Promise<SubjectResponseDto> {
		const subject = await this.subjectRepository.save(params);

		return subject;
	}
}
