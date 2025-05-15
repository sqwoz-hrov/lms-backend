import { OmitType } from '@nestjs/swagger';
import { BaseFeedbackDto } from './base-feedback.dto';

export class CreateFeedbackDto extends OmitType(BaseFeedbackDto, ['id']) {}
