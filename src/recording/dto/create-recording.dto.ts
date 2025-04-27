import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateRecordingDto {
	@ApiProperty({
		description: 'The name of the recording',
		example: 'Introduction to TypeScript',
	})
	@IsString()
	@IsNotEmpty()
	@MinLength(3, { message: 'Name must be at least 3 characters long' })
	name: string;

	@ApiProperty({
		description: 'The ID of the event type this recording belongs to',
		example: 1,
	})
	@IsNumber()
	@IsNotEmpty()
	eventTypeId: number;

	@ApiProperty({
		description: 'The URL where the recording can be accessed',
		example: 'https://example.com/recordings/intro-typescript',
	})
	@IsString()
	@IsNotEmpty()
	@IsUrl({}, { message: 'URL must be a valid URL' })
	url: string;
}
