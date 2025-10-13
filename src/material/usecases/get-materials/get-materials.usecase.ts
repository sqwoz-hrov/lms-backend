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
		const filters: {
			subject_id?: string;
			student_user_id?: string;
			is_archived?: boolean;
		} = { ...params };

		if (user.role === 'user') {
			filters.student_user_id = user.id;
			delete filters.is_archived;
		}

		let subscriptionTierId: string | undefined;

		if (user.role === 'subscriber') {
			subscriptionTierId = user.subscription_tier_id ?? undefined;
			delete filters.is_archived;
			delete filters.student_user_id;

			if (!subscriptionTierId) {
				return [];
			}
		}

		const materials = await this.materialRepository.find({ ...filters, subscription_tier_id: subscriptionTierId });

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
