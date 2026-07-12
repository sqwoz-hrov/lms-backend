import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubscriptionTierResponseDto } from '../../dto/base-subscription-tier.dto';
import { SubscriptionTierRepository } from '../../subscription-tier.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';

@Injectable()
export class GetSubscriptionTiersUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionTierRepository: SubscriptionTierRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(): Promise<SubscriptionTierResponseDto[]> {
		const tiers = await this.subscriptionTierRepository.findAll();
		const markdownDescriptionIds = tiers
			.map(tier => tier.markdown_description_id)
			.filter((id): id is string => id !== null);
		const markdownDescriptions = await this.markdownContentService.getMarkdownContent(markdownDescriptionIds);
		const markdownDescriptionById = new Map(markdownDescriptions.map(content => [content.id, content.content_text]));

		return tiers.map(tier => {
			const { markdown_description_id, ...tierData } = tier;

			return {
				...tierData,
				markdown_description: markdown_description_id
					? markdownDescriptionById.get(markdown_description_id)
					: undefined,
			};
		});
	}
}
