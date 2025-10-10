import { BadRequestException, Injectable } from '@nestjs/common';
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

		const { id, markdown_content, ...updateData } = params;
		const targetType = updateData.type ?? existingMaterial.type;
		const updates: Record<string, any> = { ...updateData };

		const videoProvided = updateData?.video_id;
		const markdownIdProvided = updateData?.markdown_content_id;

		const nextVideoId =
			targetType === 'article'
				? videoProvided
					? updateData.video_id
					: null
				: videoProvided
					? updateData.video_id
					: existingMaterial.video_id;

		const nextMarkdownId =
			targetType === 'video'
				? markdownIdProvided
					? updateData.markdown_content_id
					: null
				: markdownIdProvided
					? updateData.markdown_content_id
					: existingMaterial.markdown_content_id;

		const hasMarkdownPayload = markdown_content !== undefined;
		const willHaveMarkdown = hasMarkdownPayload || (nextMarkdownId !== undefined && nextMarkdownId !== null);
		const willHaveVideo = nextVideoId !== undefined && nextVideoId !== null;

		if (targetType === 'video') {
			if (willHaveMarkdown) {
				throw new BadRequestException('Markdown content is not allowed for video materials');
			}
			updates.markdown_content_id = null;
		} else if (targetType === 'article') {
			if (willHaveVideo) {
				throw new BadRequestException('Video id is not allowed for article materials');
			}
			if (!willHaveMarkdown) {
				throw new BadRequestException('Article materials require markdown content');
			}
			updates.video_id = null;
		} else if (targetType !== 'other') {
			throw new BadRequestException('Unsupported material type');
		}

		const markdownContent = markdown_content
			? await this.markdownContentService.uploadMarkdownContent(markdown_content)
			: undefined;

		if (markdownContent && !markdownIdProvided) {
			updates.markdown_content_id = markdownContent.id;
		}

		const updatedMaterial = await this.materialRepository.update(id, updates as any);

		return {
			...updatedMaterial,
			markdown_content: markdownContent?.content_text,
		};
	}
}
