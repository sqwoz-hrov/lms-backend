import { ApiProperty } from '@nestjs/swagger';

export class RecordingResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the recording',
    example: 1
  })
  id: number;

  @ApiProperty({
    description: 'The name of the recording',
    example: 'Introduction to TypeScript'
  })
  name: string;

  @ApiProperty({
    description: 'The ID of the event type this recording belongs to',
    example: 1
  })
  eventTypeId: number;

  @ApiProperty({
    description: 'The event type object this recording belongs to',
    example: { id: 1, name: 'Workshop', description: 'Interactive learning session' }
  })
  eventType: {
    id: number;
    name: string;
    description?: string;
  };

  @ApiProperty({
    description: 'The URL where the recording can be accessed',
    example: 'https://example.com/recordings/intro-typescript'
  })
  url: string;
}
