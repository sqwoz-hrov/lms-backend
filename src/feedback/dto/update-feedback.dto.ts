import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { BaseFeedbackDto } from './base-feedback.dto';

export class UpdateFeedbackDto extends IntersectionType(
	PickType(BaseFeedbackDto, ['id']),
	PartialType(OmitType(BaseFeedbackDto, ['id', 'markdown_content_id'])),
) {}
