import { v7 } from 'uuid';
import { VideosTestRepository } from '../../src/video/test-utils/test.repo';
import { NewVideo, Video } from '../../src/video/video.entity';
import { sql } from 'kysely';

export const createTestVideoRecord = async (
	videoRepository: VideosTestRepository,
	user_id: string,
	overrides: Partial<NewVideo> = {},
): Promise<Video> => {
	const video = await videoRepository.connection
		.insertInto('video')
		.values({
			user_id,
			filename: 'test-video.mp4',
			mime_type: 'video/mp4',
			total_size: '100',
			chunk_size: '10',
			tmp_path: `/tmp/${v7()}.mp4`,
			converted_tmp_path: null,
			phase: 'completed',
			uploaded_ranges: sql`${JSON.stringify([{ start: 0, end: 100 }])}`,
			storage_key: 'videos/test-video.mp4',
			checksum_sha256_base64: null,
			created_at: new Date().toISOString(),
			...overrides,
		})
		.returningAll()
		.executeTakeFirstOrThrow();

	return video;
};
