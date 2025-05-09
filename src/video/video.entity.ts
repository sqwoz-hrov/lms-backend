import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export type VideoTable = {
	id: Generated<string>;
	youtube_link: string;
	s3_object_id: string;
	content_type: string | undefined;
};

export type Video = Selectable<VideoTable>;

export type NewVideo = Insertable<VideoTable>;

export type VideoUpdate = Updateable<VideoTable>;

export interface VideoAggregation {
	video: VideoTable;
}
