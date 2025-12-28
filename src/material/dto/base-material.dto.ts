import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { strictToBoolean } from '../../common/nest/transform-pipes/transform-boolean';

export class BaseMaterialDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	id: string;

	@ApiProperty({ required: false, type: 'string', nullable: true })
	@IsUUID()
	@IsOptional()
	student_user_id?: string | null;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	subject_id: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	name: string;

	@ApiProperty({ required: false, type: 'string', nullable: true })
	@IsString()
	@IsOptional()
	video_id: string | null | undefined;

	@ApiProperty({ required: false, type: 'string', nullable: true })
	@IsString()
	@IsOptional()
	markdown_content_id: string | null | undefined;

	@ApiProperty({ description: 'Resolved markdown content as text', required: false, type: 'string', nullable: true })
	@IsString()
	@IsOptional()
	markdown_content?: string | null | undefined;

	@ApiProperty()
	@IsBoolean()
	@Transform(strictToBoolean)
	is_archived: boolean;
}
