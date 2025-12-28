import { BadRequestException, Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { MarkdownContentService } from '../../../markdown-content/services/markdown-content.service';
import { MaterialResponseDto } from '../../dto/material-response.dto';
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

		const { id, markdown_content, ...updateData } = params;
		const updates = { ...updateData };

		let markdownContentId =
			updateData.markdown_content_id !== undefined
				? updateData.markdown_content_id
				: existingMaterial.markdown_content_id;

		let markdownContent: Awaited<ReturnType<MarkdownContentService['uploadMarkdownContent']>> | undefined;

		if (typeof markdown_content === 'string') {
			const resolvedMarkdownId = typeof markdownContentId === 'string' ? markdownContentId : undefined;

			if (resolvedMarkdownId && resolvedMarkdownId.length > 0) {
				markdownContent = await this.markdownContentService.updateMarkdownContent(resolvedMarkdownId, markdown_content);
				markdownContentId = resolvedMarkdownId;
			} else {
				markdownContent = await this.markdownContentService.uploadMarkdownContent(markdown_content);
				markdownContentId = markdownContent.id;
			}
		}

		if (markdownContentId !== undefined) {
			updates.markdown_content_id = markdownContentId;
		}

		const nextVideoId = updateData.video_id !== undefined ? updateData.video_id : existingMaterial.video_id;

		let nextMarkdownId: string | null;

		if (updates.markdown_content_id !== undefined) {
			nextMarkdownId = updates.markdown_content_id;
		} else {
			nextMarkdownId = existingMaterial.markdown_content_id;
		}

		const willHaveMarkdown = nextMarkdownId !== undefined && nextMarkdownId !== null;
		const willHaveVideo = nextVideoId !== undefined && nextVideoId !== null;

		if (!willHaveMarkdown && !willHaveVideo) {
			throw new BadRequestException('Material must include video or markdown content');
		}

		const updatedMaterial = await this.materialRepository.update(id, updates);

		return {
			...updatedMaterial,
			markdown_content: markdownContent?.content_text,
		};
	}
}
