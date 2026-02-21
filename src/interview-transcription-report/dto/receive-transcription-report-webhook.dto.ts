import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ReceiveTranscriptionReportWebhookDto {
	@ApiProperty()
	@IsUUID()
	transcriptionId: string;

	@ApiProperty({ type: 'array' })
	llmReportParsed: unknown;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	candidateNameInTranscription: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	llmReportRaw: string;
}
