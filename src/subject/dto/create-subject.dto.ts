import { OmitType } from '@nestjs/swagger';
import { BaseSubjectDto } from './base-subject.dto';

export class CreateSubjectDto extends OmitType(BaseSubjectDto, ['id']) {}
