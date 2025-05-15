import { PartialType, PickType } from '@nestjs/swagger';
import { BaseInterviewDto } from './base-interview.dto';

export class GetInterviewsDto extends PartialType(PickType(BaseInterviewDto, ['hr_connection_id', 'type', 'name'])) {}
