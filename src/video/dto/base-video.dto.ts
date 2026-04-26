import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsDateString,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	Min,
	ValidateNested,
} from 'class-validator';

export const UploadPhaseEnum = ['receiving', 'converting', 'hashing', 'uploading_s3', 'completed', 'failed'] as const;
export type UploadPhase = (typeof UploadPhaseEnum)[number];

// Reusable numeric-string validator: only non-negative integers in decimal form
const NUMERIC_STRING = /^[0-9]+$/;

export class UploadedRangeDto {
	@ApiProperty({ description: 'Начало диапазона (в байтах)', example: 0 })
	@IsInt()
	@Min(0)
	start: number;

	@ApiProperty({ description: 'Конец диапазона (включительно, в байтах)', example: 1048575 })
	@IsInt()
	@Min(0)
	end: number;
}

export class UploadChecksumDto {
	@ApiProperty({ enum: ['sha256', 'md5'], description: 'Алгоритм контрольной суммы' })
	@IsEnum(['sha256', 'md5'])
	algo: 'sha256' | 'md5';

	@ApiProperty({ description: 'Значение контрольной суммы в base64' })
	@IsString()
	@IsNotEmpty()
	value_base64: string;
}

export class BaseVideoDto {
	@ApiProperty({ description: 'UUID видео' })
	@IsString()
	@IsNotEmpty()
	id: string;

	@ApiProperty({ description: 'ID пользователя-владельца' })
	@IsString()
	@IsNotEmpty()
	user_id: string;

	@ApiProperty({ description: 'Имя файла (как сохранено)', example: 'lecture-001.mp4' })
	@IsString()
	@IsNotEmpty()
	filename: string;

	@ApiProperty({ description: 'MIME-тип файла', nullable: true, required: false, example: 'video/mp4' })
	@IsString()
	@IsOptional()
	mime_type?: string | null;

	@ApiProperty({ description: 'Общий размер файла, байт (строкой)', example: '10737418240' })
	@IsString()
	@Matches(NUMERIC_STRING, { message: 'total_size must be a non-negative integer string' })
	total_size: string;

	@ApiProperty({ description: 'Размер чанка, байт (строкой)', example: '1048576' })
	@IsString()
	@Matches(NUMERIC_STRING, { message: 'chunk_size must be a non-negative integer string' })
	chunk_size: string;

	@ApiProperty({ enum: UploadPhaseEnum, description: 'Текущая фаза загрузки' })
	@IsEnum(UploadPhaseEnum)
	phase: UploadPhase;

	@ApiProperty({
		description: 'Список уже принятых диапазонов (включительно)',
		type: [UploadedRangeDto],
		example: [
			{ start: '0', end: '1048575' },
			{ start: '1048576', end: '2097151' },
		],
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UploadedRangeDto)
	uploaded_ranges: UploadedRangeDto[];

	@ApiProperty({
		description: 'Текущий смещенный байт (offset), от начала файла (строкой)',
		example: '2097152',
	})
	@IsString()
	@Matches(NUMERIC_STRING, { message: 'upload_offset must be a non-negative integer string' })
	upload_offset: string;

	@ApiProperty({
		description: 'Контрольная сумма загружаемого файла',
		type: () => UploadChecksumDto,
		required: false,
		nullable: true,
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => UploadChecksumDto)
	checksum?: UploadChecksumDto | null;

	@ApiProperty({
		description: 'Когда создано (ISO 8601)',
		format: 'date-time',
		example: '2025-09-28T10:15:30.000Z',
	})
	@IsDateString()
	created_at: Date;

	@ApiPropertyOptional({
		description: 'Фаза, на которой загрузка завершилась ошибкой',
		enum: UploadPhaseEnum,
		nullable: true,
	})
	@IsOptional()
	@IsEnum(UploadPhaseEnum)
	upload_failed_phase?: UploadPhase | null;

	@ApiPropertyOptional({
		description: 'Причина, по которой загрузка завершилась ошибкой',
		nullable: true,
	})
	@IsOptional()
	@IsString()
	upload_failed_reason?: string | null;

	@ApiPropertyOptional({
		description: 'Когда загрузка перешла в терминальное состояние failed',
		format: 'date-time',
		nullable: true,
	})
	@IsOptional()
	@IsDateString()
	upload_failed_at?: Date | null;
}

export class VideoResponseDto extends BaseVideoDto {}

export class GetVideoByIdResponseDto extends BaseVideoDto {
	@ApiPropertyOptional({
		description: 'Подписанная ссылка доступа с ограниченным временем доступа',
	})
	video_url?: string;
}

export class VideoUploadStatusResponseDto {
	@ApiProperty({ description: 'ID upload-сессии' })
	@IsString()
	@IsNotEmpty()
	sessionId: string;

	@ApiProperty({ enum: UploadPhaseEnum, description: 'Текущая фаза загрузки' })
	@IsEnum(UploadPhaseEnum)
	phase: UploadPhase;

	@ApiProperty({ description: 'Текущий offset в байтах', example: '2097152' })
	@IsString()
	@Matches(NUMERIC_STRING, { message: 'offset must be a non-negative integer string' })
	offset: string;

	@ApiProperty({ description: 'Общий размер файла в байтах', example: '10737418240' })
	@IsString()
	@Matches(NUMERIC_STRING, { message: 'total_size must be a non-negative integer string' })
	total_size: string;

	@ApiProperty({ description: 'Уже загруженные диапазоны', type: [UploadedRangeDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UploadedRangeDto)
	ranges: UploadedRangeDto[];

	@ApiPropertyOptional({
		enum: UploadPhaseEnum,
		nullable: true,
		description: 'Фаза, для которой ведётся счётчик ретраев',
	})
	@IsOptional()
	@IsEnum(UploadPhaseEnum)
	retry_phase?: UploadPhase | null;

	@ApiProperty({ description: 'Текущее число подряд неудачных попыток для retry_phase', example: 1 })
	@IsInt()
	@Min(0)
	retry_count: number;

	@ApiPropertyOptional({ description: 'Лимит дополнительных ретраев для указанной фазы', nullable: true, example: 2 })
	@IsOptional()
	@IsInt()
	@Min(0)
	retry_limit?: number | null;

	@ApiPropertyOptional({ enum: UploadPhaseEnum, nullable: true, description: 'Фаза терминального падения' })
	@IsOptional()
	@IsEnum(UploadPhaseEnum)
	failed_phase?: UploadPhase | null;

	@ApiPropertyOptional({ description: 'Последняя причина терминального падения', nullable: true })
	@IsOptional()
	@IsString()
	failed_reason?: string | null;

	@ApiPropertyOptional({ description: 'Время терминального падения', format: 'date-time', nullable: true })
	@IsOptional()
	@IsDateString()
	failed_at?: Date | null;
}
