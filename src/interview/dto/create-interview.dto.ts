import { OmitType } from '@nestjs/swagger';
import { BaseInterviewDto } from './base-interview.dto';

export class CreateInterviewDto extends OmitType(BaseInterviewDto, ['id', 'created_at']) {}
