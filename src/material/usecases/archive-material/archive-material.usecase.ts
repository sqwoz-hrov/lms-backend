import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { MaterialResponseDto } from '../../dto/base-material.dto';
import { ArchiveMaterialDto } from '../../dto/archive-material.dto';
import { MaterialRepository } from '../../material.repository';

@Injectable()
export class ArchiveMaterialUsecase implements UsecaseInterface {
	constructor(
		private readonly materialRepository: MaterialRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(params: ArchiveMaterialDto): Promise<MaterialResponseDto> {
		const existingMaterial = await this.materialRepository.findById(params.id);

		if (!existingMaterial) {
			throw new Error(`Material with id ${params.id} not found`);
		}

		const updatedMaterial = await this.materialRepository.update(params.id, {
			is_archived: params.is_archived,
		});

		const markdownContent = updatedMaterial.markdown_content_id
			? await this.markdownContentService.getMarkdownContent(updatedMaterial.markdown_content_id)
			: undefined;

		return {
			...updatedMaterial,
			markdown_content: markdownContent?.content_text,
		};
	}
}
