import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { InterviewTranscriptionStatus, STATUS_VALUES } from '../interview-transcription.entity';

export class InterviewTranscriptionVideoDto {
	@ApiProperty()
	@IsUUID()
	id: string;

	@ApiProperty()
	@IsUUID()
	user_id: string;

	@ApiProperty()
	@IsString()
	filename: string;

	@ApiPropertyOptional({ nullable: true })
	@IsOptional()
	@IsString()
	mime_type?: string | null;

	@ApiProperty()
	@IsDate()
	created_at: Date;
}

export class InterviewTranscriptionResponseDto {
	@ApiProperty()
	@IsUUID()
	id: string;

	@ApiProperty()
	@IsUUID()
	video_id: string;

	@ApiProperty({ enum: STATUS_VALUES })
	@IsEnum(STATUS_VALUES)
	status: InterviewTranscriptionStatus;

	@ApiPropertyOptional({ nullable: true })
	@IsOptional()
	@IsString()
	s3_transcription_key?: string | null;

	@ApiPropertyOptional({
		description: 'Временная ссылка для скачивания транскрибации',
	})
	@IsOptional()
	@IsString()
	transcription_url?: string;

	@ApiProperty()
	@IsDate()
	created_at: Date;

	@ApiPropertyOptional({ type: () => InterviewTranscriptionVideoDto })
	@IsOptional()
	@Type(() => InterviewTranscriptionVideoDto)
	video?: InterviewTranscriptionVideoDto;
}
