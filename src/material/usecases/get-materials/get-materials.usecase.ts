import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { User } from '../../../user/user.entity';
import { MaterialResponseDto } from '../../dto/base-material.dto';
import { GetMaterialsDto } from '../../dto/get-materials.dto';
import { MaterialRepository } from '../../material.repository';

@Injectable()
export class GetMaterialsUsecase implements UsecaseInterface {
	constructor(
		private readonly materialRepository: MaterialRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute({ user, params }: { user: User; params: GetMaterialsDto }): Promise<MaterialResponseDto[]> {
		if (user.role === 'user') {
			params.student_user_id = user.id;
			delete params.is_archived;
		}

		const materials = await this.materialRepository.find(params);

		const enrichedMaterials = await Promise.all(
			materials.map(async material => {
				const markdownContent = material.markdown_content_id
					? await this.markdownContentService.getMarkdownContent(material.markdown_content_id)
					: undefined;

				return {
					...material,
					markdown_content: markdownContent?.content_text,
				};
			}),
		);

		return enrichedMaterials;
	}
}
