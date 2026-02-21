import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ReceiveTranscriptionReportWebhookDto {
	@ApiProperty({
		type: 'string',
		format: 'uuid-v7',
		description: 'The ID of the interview transcription this report is for',
	})
	@IsUUID()
	transcriptionId: string;

	@ApiProperty({ type: 'array' })
	@IsArray()
	llmReportParsed: unknown[];

	@ApiProperty({
		type: 'string',
		description: 'The name of the candidate as it appears in the transcription',
		examples: ['SPEAKER_01', 'SPEAKER_02'],
	})
	@IsString()
	@IsNotEmpty()
	candidateNameInTranscription: string;

	@ApiProperty({
		type: 'string',
		description: 'The actual name of the candidate',
		examples: ['John Doe', 'Jane Smith'],
	})
	@IsString()
	@IsNotEmpty()
	@IsOptional()
	candidateName?: string;
}
