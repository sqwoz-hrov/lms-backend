import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export type UploadPhase = 'receiving' | 'converting' | 'hashing' | 'uploading_s3' | 'completed' | 'failed';

export type UploadedRange = { start: number; end: number };

export type VideoTable = {
	id: Generated<string>;
	user_id: string;
	filename: string;
	mime_type: string | null;
	total_size: string;
	chunk_size: string;
	tmp_path: string;
	converted_tmp_path: string | null;
	phase: UploadPhase;
	uploaded_ranges: UploadedRange[];
	upload_offset: Generated<string>;
	checksum_sha256_base64: string | null;
	storage_key: string | null;
	created_at: ColumnType<Date, string | undefined, never>;
};

export type Video = Selectable<VideoTable>;

export type NewVideo = Insertable<VideoTable>;

export type VideoUpdate = Updateable<VideoTable>;

export interface VideoAggregation {
	video: VideoTable;
}
