import { PartialType, PickType } from '@nestjs/swagger';
import { BaseFeedbackDto } from './base-feedback.dto';

export class GetAllFeedbackDto extends PartialType(PickType(BaseFeedbackDto, ['interview_id'])) {}
