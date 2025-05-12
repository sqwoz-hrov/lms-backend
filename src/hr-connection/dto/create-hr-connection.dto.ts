import { OmitType } from '@nestjs/swagger';
import { BaseHrConnectionDto } from './base-hr-connection.dto';

export class CreateHrConnectionDto extends OmitType(BaseHrConnectionDto, ['id', 'created_at']) {}
