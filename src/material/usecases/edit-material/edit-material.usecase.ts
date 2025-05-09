import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { MaterialResponseDto } from '../../dto/base-material.dto';
import { UpdateMaterialDto } from '../../dto/update-material.dto';
import { MaterialRepository } from '../../material.repository';

@Injectable()
export class EditMaterialUsecase implements UsecaseInterface {
	constructor(
		private readonly materialRepository: MaterialRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(params: UpdateMaterialDto): Promise<MaterialResponseDto> {
		const existingMaterial = await this.materialRepository.findById(params.id);

		if (!existingMaterial) {
			throw new Error(`Material with id ${params.id} not found`);
		}

		const markdownContent = params.markdown_content
			? await this.markdownContentService.uploadMarkdownContent(params.markdown_content)
			: undefined;

		const { id, ...updateData } = params;

		const updatedMaterial = await this.materialRepository.update(id, {
			...updateData,
		});

		return {
			...updatedMaterial,
			markdown_content: markdownContent?.content_text,
		};
	}
}
