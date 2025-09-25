// test-utils/test.sdk.videos.ts (или куда ты положил VideosTestSdk)
import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { FormData, File } from 'undici';

type UploadVideoParams = {
	file: Buffer;
	filename?: string;
	// mime?: string; // при желании можно добавить
};

export class VideosTestSdk implements ValidateSDK<VideosTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	/**
	 * Загружает видео на POST /videos через multipart/form-data
	 * Поле файла называется `file` — его перехватит FileParserInterceptor.
	 * Не используем Readable: только File + FormData из undici.
	 */
	public async uploadVideo({ params, userMeta }: { params: UploadVideoParams; userMeta: UserMeta }) {
		const filename = params.filename ?? 'test-video.bin';

		// создаём Web File на основе Buffer — это не stream
		const file = new File([params.file], filename, {
			type: 'application/octet-stream',
			// lastModified: Date.now(),
		});

		const form = new FormData();
		// имя поля ДОЛЖНО быть "file", т.к. интерсептор смотрит именно на него
		form.append('file', file, filename);

		// используем общий клиент, который умеет и JSON, и FormData
		return await this.testClient.request<any>({
			path: '/videos',
			method: 'POST',
			body: form, // передаём FormData напрямую
			userMeta,
		});
	}
}
