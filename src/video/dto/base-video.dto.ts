import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class BaseVideoDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	id: string;

	@ApiProperty()
	@IsUrl()
	@IsNotEmpty()
	youtube_link: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	s3_object_id: string;
}

export class VideoResponseDto extends BaseVideoDto {}
