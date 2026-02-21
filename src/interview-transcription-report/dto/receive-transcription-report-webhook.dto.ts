import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ReceiveTranscriptionReportWebhookDto {
	@ApiProperty()
	@IsUUID()
	transcriptionId: string;

	@ApiProperty({ type: 'array' })
	@IsArray()
	llmReportParsed: unknown[];

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	candidateNameInTranscription: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	llmReportRaw: string;
}
