import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class InterviewTranscriptionReportResponseDto {
	@ApiProperty()
	@IsUUID()
	id: string;

	@ApiProperty()
	@IsUUID()
	interview_transcription_id: string;

	@ApiProperty({ type: 'array' })
	llm_report_parsed: unknown;

	@ApiProperty()
	@IsString()
	candidate_name_in_transcription: string;

	@ApiProperty()
	@IsString()
	llm_report_raw: string;
}
