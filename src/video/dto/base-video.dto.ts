import { ApiProperty } from '@nestjs/swagger';
import {
	IsArray,
	IsDateString,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsPositive,
	IsString,
	Min,
	ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const UploadPhaseEnum = ['receiving', 'hashing', 'uploading_s3', 'completed', 'failed'] as const;
export type UploadPhase = (typeof UploadPhaseEnum)[number];

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
	valueBase64: string;
}

export class BaseVideoDto {
	@ApiProperty({ description: 'UUID видео' })
	@IsString()
	@IsNotEmpty()
	id: string;

	@ApiProperty({ description: 'ID пользователя-владельца' })
	@IsString()
	@IsNotEmpty()
	userId: string;

	@ApiProperty({ description: 'Имя файла (как сохранено)', example: 'lecture-001.mp4' })
	@IsString()
	@IsNotEmpty()
	filename: string;

	@ApiProperty({ description: 'MIME-тип файла', nullable: true, required: false, example: 'video/mp4' })
	@IsString()
	@IsOptional()
	mimeType?: string | null;

	@ApiProperty({ description: 'Общий размер файла, байт', example: 10737418240 })
	@IsInt()
	@IsPositive()
	totalSize: number;

	@ApiProperty({ description: 'Размер чанка, байт', example: 1048576 })
	@IsInt()
	@IsPositive()
	chunkSize: number;

	@ApiProperty({ enum: UploadPhaseEnum, description: 'Текущая фаза загрузки' })
	@IsEnum(UploadPhaseEnum)
	phase: UploadPhase;

	@ApiProperty({
		description: 'Список уже принятых диапазонов (включительно)',
		type: [UploadedRangeDto],
		example: [
			{ start: 0, end: 1048575 },
			{ start: 1048576, end: 2097151 },
		],
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UploadedRangeDto)
	uploadedRanges: UploadedRangeDto[];

	@ApiProperty({ description: 'Текущий смещенный байт (offset), от начала файла', example: 2097152 })
	@IsInt()
	@Min(0)
	uploadOffset: number;

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
	createdAt: Date;
}

export class VideoResponseDto extends BaseVideoDto {}
