import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { MaterialResponseDto } from '../../dto/base-material.dto';
import { CreateMaterialDto } from '../../dto/create-material.dto';
import { MaterialRepository } from '../../material.repository';

@Injectable()
export class CreateMaterialUsecase implements UsecaseInterface {
	constructor(
		private readonly materialRepository: MaterialRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(params: CreateMaterialDto): Promise<MaterialResponseDto> {
		const { markdown_content, ...materialData } = params;

		const markdownContent = markdown_content
			? await this.markdownContentService.uploadMarkdownContent(markdown_content)
			: undefined;

		const material = await this.materialRepository.save({ ...materialData, markdown_content_id: markdownContent?.id });

		return {
			...material,
			markdown_content: markdownContent?.content_text,
		};
	}
}
