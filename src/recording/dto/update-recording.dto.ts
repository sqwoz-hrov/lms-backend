import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class UpdateRecordingDto {
  @ApiPropertyOptional({
    description: 'The updated name of the recording',
    example: 'Advanced TypeScript Techniques'
  })
  @IsString()
  @IsOptional()
  @MinLength(3, { message: 'Name must be at least 3 characters long' })
  name?: string;

  @ApiPropertyOptional({
    description: 'The updated event type ID',
    example: 2
  })
  @IsNumber()
  @IsOptional()
  eventTypeId?: number;

  @ApiPropertyOptional({
    description: 'The updated URL where the recording can be accessed',
    example: 'https://example.com/recordings/advanced-typescript'
  })
  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'URL must be a valid URL' })
  url?: string;
}
