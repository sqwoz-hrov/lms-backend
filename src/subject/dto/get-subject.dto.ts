import { PartialType } from '@nestjs/swagger';
import { BaseSubjectDto } from './base-subject.dto';

export class GetSubjectsDto extends PartialType(BaseSubjectDto) {}
