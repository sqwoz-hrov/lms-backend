import { PartialType, PickType } from '@nestjs/swagger';
import { BaseHrConnectionDto } from './base-hr-connection.dto';

export class GetHrConnectionsDto extends PartialType(
	PickType(BaseHrConnectionDto, ['student_user_id', 'status', 'name']),
) {}
