import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubjectRepository } from '../../subject.repository';
import { UpdateSubjectDto } from '../../dto/update-subject.dto';
import { SubjectResponseDto } from '../../dto/base-subject.dto';

@Injectable()
export class EditSubjectUsecase implements UsecaseInterface {
	constructor(private readonly subjectRepository: SubjectRepository) {}

	async execute(params: UpdateSubjectDto): Promise<SubjectResponseDto> {
		const { id, ...updates } = params;
		const existing = await this.subjectRepository.findById(id);

		if (!existing) {
			throw new NotFoundException('Предмет не найден');
		}

		const updated = await this.subjectRepository.update(id, updates);

		return updated;
	}
}
