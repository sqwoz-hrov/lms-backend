import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { CreateSubscriptionTierDto } from '../../dto/create-subscription-tier.dto';
import { SubscriptionTierResponseDto } from '../../dto/base-subscription-tier.dto';
import { SubscriptionTierRepository } from '../../subscription-tier.repository';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';

@Injectable()
export class CreateSubscriptionTierUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionTierRepository: SubscriptionTierRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(dto: CreateSubscriptionTierDto): Promise<SubscriptionTierResponseDto> {
		const { markdown_description, ...tierData } = dto;
		const markdownDescription =
			typeof markdown_description === 'string'
				? await this.markdownContentService.uploadMarkdownContent(markdown_description)
				: undefined;

		const created = await this.subscriptionTierRepository.create({
			...tierData,
			markdown_description_id: markdownDescription?.id,
		});
		const { markdown_description_id, ...createdTier } = created;

		return {
			...createdTier,
			markdown_description: markdownDescription?.content_text,
		};
	}
}
