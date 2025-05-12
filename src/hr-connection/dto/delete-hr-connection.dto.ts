import { PickType } from '@nestjs/swagger';
import { BaseHrConnectionDto } from './base-hr-connection.dto';

export class DeleteHrConnectionDto extends PickType(BaseHrConnectionDto, ['id']) {}
