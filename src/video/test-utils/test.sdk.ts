import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import * as FormData from 'form-data';
import { VideoResponseDto } from '../dto/base-video.dto';

export interface UploadVideoParams {
	file: Buffer;
	filename?: string;
}

export interface UploadChunkParams extends UploadVideoParams {
	totalSize: number;
	start: number;
	end: number;
}

export type UploadChunkHeaders = Record<string, string | number> & {
	'content-range': string;
	'upload-session-id'?: string;
	'upload-chunk-size'?: string;
};

export interface UploadOptions<T = UploadVideoParams> {
	params: T;
	userMeta: UserMeta;
	headers?: UploadChunkHeaders;
}

export class VideosTestSdk implements ValidateSDK<VideosTestSdk> {
	private static readonly DEFAULT_FILENAME = 'test-video.bin';
	private static readonly DEFAULT_CONTENT_TYPE = 'application/octet-stream';

	constructor(private readonly testClient: TestHttpClient) {}

	async uploadVideo<VideoResponseDto>({ params, userMeta }: UploadOptions) {
		const form = this.createFormData(params.file, params.filename);

		return await this.testClient.request<VideoResponseDto>({
			path: '/videos',
			method: 'POST',
			body: form,
			userMeta,
		});
	}

	async uploadChunk({ params, userMeta, headers }: UploadOptions<UploadChunkParams>) {
		const { start, end, file, filename } = params;

		// Accept either the full source buffer or the already-sliced chunk buffer
		const expectedChunkLength = end - start + 1;
		const chunkBuffer = file.length === expectedChunkLength ? file : file.subarray(start, end + 1);
		const form = this.createFormData(chunkBuffer, filename);

		// Build headers with proper types

		return await this.testClient.request<VideoResponseDto>({
			path: '/videos',
			method: 'POST',
			body: form,
			headers,
			userMeta,
		});
	}

	/**
	 * Create FormData with a file buffer
	 */
	private createFormData(buffer: Buffer, filename?: string): FormData {
		const form = new FormData();
		const finalFilename = filename ?? VideosTestSdk.DEFAULT_FILENAME;

		form.append('file', buffer, {
			filename: finalFilename,
			contentType: VideosTestSdk.DEFAULT_CONTENT_TYPE,
		});

		return form;
	}

	/**
	 * Helper to create content-range header value
	 */
	public static createContentRange(start: number, end: number, total: number): string {
		return `bytes ${start}-${end}/${total}`;
	}

	/**
	 * Helper to calculate chunk boundaries for multi-part uploads
	 */
	public static calculateChunks(totalSize: number, chunkSize: number): Array<{ start: number; end: number }> {
		const chunks: Array<{ start: number; end: number }> = [];
		let start = 0;

		while (start < totalSize) {
			const end = Math.min(start + chunkSize - 1, totalSize - 1);
			chunks.push({ start, end });
			start = end + 1;
		}

		return chunks;
	}
}
