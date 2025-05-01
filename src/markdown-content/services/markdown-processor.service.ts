import { ConfigType } from '@nestjs/config';
import { IImageStorageAdapter } from '../ports/image-storage.adapter';
import { imageStorageConfig } from '../../config';
import { Inject, Injectable } from '@nestjs/common';
import { IMAGE_STORAGE_ADAPTER } from '../constants';

@Injectable()
export class MarkdownProcessorService {
	constructor(
		@Inject(IMAGE_STORAGE_ADAPTER)
		private readonly imageStorageAdapter: IImageStorageAdapter,
		@Inject(imageStorageConfig.KEY)
		private readonly config: ConfigType<typeof imageStorageConfig>,
	) {}

	private extractInlineImageMatches(markdown: string): { url: string; fullMatch: string }[] {
		const regex = /!\[.*?]\((.*?)\)/g;
		const matches: { url: string; fullMatch: string }[] = [];
		let match: RegExpExecArray | null;

		while ((match = regex.exec(markdown)) !== null) {
			const url = match[1];
			if (url && !url.startsWith(this.config.imageStorageUrl)) {
				matches.push({ url, fullMatch: match[0] });
			}
		}
		return matches;
	}

	private extractReferenceDefinitionMatches(markdown: string): { url: string; definition: string }[] {
		const regex = /^[ \t]{0,3}\[([^\]]+)]\s*:\s*(\S+)/gm;

		const matches: { url: string; definition: string }[] = [];
		let match: RegExpExecArray | null;

		while ((match = regex.exec(markdown)) !== null) {
			const url = match[2];
			if (url && !url.startsWith(this.config.imageStorageUrl)) {
				matches.push({ url, definition: match[0] });
			}
		}
		return matches;
	}

	async processMarkdown(markdown: string): Promise<string> {
		// Process inline image URLs
		const inlineMatches = this.extractInlineImageMatches(markdown);
		const inlineUploadResults = await Promise.all(inlineMatches.map(m => this.imageStorageAdapter.uploadImage(m.url)));
		inlineMatches.forEach((match, index) => {
			const updatedImage = match.fullMatch.replace(match.url, inlineUploadResults[index]);
			markdown = markdown.replace(match.fullMatch, updatedImage);
		});

		// Process reference-style image definitions
		const referenceMatches = this.extractReferenceDefinitionMatches(markdown);
		const referenceUploadResults = await Promise.all(
			referenceMatches.map(m => this.imageStorageAdapter.uploadImage(m.url)),
		);
		referenceMatches.forEach((match, index) => {
			const updatedDefinition = match.definition.replace(match.url, referenceUploadResults[index]);
			markdown = markdown.replace(match.definition, updatedDefinition);
		});

		return markdown;
	}
}
