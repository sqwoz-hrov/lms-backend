import { PartialType, PickType, IntersectionType } from '@nestjs/swagger';
import { BaseSubjectDto } from './base-subject.dto';

export class UpdateSubjectDto extends IntersectionType(PartialType(BaseSubjectDto), PickType(BaseSubjectDto, ['id'])) {}
