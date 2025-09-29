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

export interface UploadChunkHeaders {
	'content-range': string;
	'upload-session-id'?: string;
	'upload-chunk-size'?: number;
}

export interface UploadOptions<T = UploadVideoParams> {
	params: T;
	userMeta: UserMeta;
	headers?: Record<string, string | number>;
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

	async uploadChunk({ params, userMeta, headers }: UploadOptions<UploadChunkParams> & { headers: UploadChunkHeaders }) {
		const { start, end, file, filename } = params;

		// Extract only the bytes for this chunk
		const chunkBuffer = file.subarray(start, end + 1);
		const form = this.createFormData(chunkBuffer, filename);

		// Build headers with proper types
		const requestHeaders = this.buildChunkHeaders(headers);

		return await this.testClient.request<VideoResponseDto>({
			path: '/videos',
			method: 'POST',
			body: form,
			headers: requestHeaders,
			userMeta,
		});
	}

	/**
	 * Upload an entire file as a single chunk (convenience method)
	 */
	public async uploadWhole({ params, userMeta }: UploadOptions) {
		const totalSize = params.file.length;

		return this.uploadChunk({
			params: {
				...params,
				totalSize,
				start: 0,
				end: totalSize - 1,
			},
			userMeta,
			headers: {
				'content-range': `bytes 0-${totalSize - 1}/${totalSize}`,
				'upload-chunk-size': Number(totalSize),
			},
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
	 * Build headers for chunk upload requests
	 */
	private buildChunkHeaders(headers: UploadChunkHeaders): Record<string, string> {
		const requestHeaders: Record<string, string> = {
			'content-range': headers['content-range'],
		};

		if (headers['upload-session-id']) {
			requestHeaders['upload-session-id'] = headers['upload-session-id'];
		}

		if (typeof headers['upload-chunk-size'] === 'number') {
			requestHeaders['upload-chunk-size'] = String(headers['upload-chunk-size']);
		}

		return requestHeaders;
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
