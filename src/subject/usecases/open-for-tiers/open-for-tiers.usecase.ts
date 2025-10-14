import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubjectRepository } from '../../subject.repository';

@Injectable()
export class OpenSubjectForTiersUsecase implements UsecaseInterface {
	constructor(private readonly subjectRepository: SubjectRepository) {}

	async execute({ subjectId, tierIds }: { subjectId: string; tierIds: string[] }): Promise<void> {
		const subject = await this.subjectRepository.findById(subjectId);

		if (!subject) {
			throw new NotFoundException('Предмет не найден');
		}

		await this.subjectRepository.openForTiers(subjectId, tierIds);
	}
}
