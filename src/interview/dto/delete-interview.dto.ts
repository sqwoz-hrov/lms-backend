import { PickType } from '@nestjs/swagger';
import { BaseInterviewDto } from './base-interview.dto';

export class DeleteInterviewDto extends PickType(BaseInterviewDto, ['id']) {}
