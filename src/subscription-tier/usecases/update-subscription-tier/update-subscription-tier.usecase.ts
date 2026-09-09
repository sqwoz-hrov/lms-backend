import { Injectable, NotFoundException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubscriptionTierResponseDto } from '../../dto/base-subscription-tier.dto';
import { UpdateSubscriptionTierDto } from '../../dto/update-subscription-tier.dto';
import { SubscriptionTierRepository } from '../../subscription-tier.repository';
import { SubscriptionTierUpdate } from '../../subscription-tier.entity';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';

@Injectable()
export class UpdateSubscriptionTierUsecase implements UsecaseInterface {
	constructor(
		private readonly subscriptionTierRepository: SubscriptionTierRepository,
		private readonly markdownContentService: MarkdownContentService,
	) {}

	async execute(dto: UpdateSubscriptionTierDto): Promise<SubscriptionTierResponseDto> {
		const existing = await this.subscriptionTierRepository.findById(dto.id);

		if (!existing) {
			throw new NotFoundException('Тариф подписки не найден');
		}

		const { id, markdown_description, ...updates } = dto;
		let markdownDescription = existing.markdown_description_id
			? await this.markdownContentService.getMarkdownContent(existing.markdown_description_id)
			: undefined;

		const filteredUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
			if (value !== undefined) {
				(acc as Record<string, unknown>)[key] = value;
			}
			return acc;
		}, {} as SubscriptionTierUpdate);

		if (markdown_description !== undefined) {
			if (markdown_description === null) {
				filteredUpdates.markdown_description_id = null;
				markdownDescription = undefined;

				if (existing.markdown_description_id) {
					const { markdown_description_id: _, ...updated } = await this.subscriptionTierRepository.update(
						id,
						filteredUpdates,
					);
					await this.markdownContentService.deleteMakdownContent(existing.markdown_description_id);

					return {
						...updated,
						permissions: updated.permissions ?? [],
					};
				}
			} else if (existing.markdown_description_id) {
				markdownDescription = await this.markdownContentService.updateMarkdownContent(
					existing.markdown_description_id,
					markdown_description,
				);
			} else {
				markdownDescription = await this.markdownContentService.uploadMarkdownContent(markdown_description);
				filteredUpdates.markdown_description_id = markdownDescription.id;
			}
		}

		const updated =
			Object.keys(filteredUpdates).length === 0
				? existing
				: await this.subscriptionTierRepository.update(id, filteredUpdates);
		const { markdown_description_id: _, ...updatedTier } = updated;

		return {
			...updatedTier,
			permissions: updatedTier.permissions ?? [],
			markdown_description: markdownDescription?.content_text,
		};
	}
}
