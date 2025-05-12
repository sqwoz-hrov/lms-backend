import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsDate, IsEnum } from 'class-validator';
import { HrConnectionStatus } from '../hr-connection.entity';

export class BaseHrConnectionDto {
	@ApiProperty()
	@IsUUID()
	id: string;

	@ApiProperty()
	@IsUUID()
	student_user_id: string;

	@ApiProperty()
	@IsString()
	name: string;

	@ApiProperty({ enum: ['waiting_us', 'waiting_hr', 'rejected', 'offer'] })
	@IsEnum(['waiting_us', 'waiting_hr', 'rejected', 'offer'])
	status: HrConnectionStatus;

	@ApiProperty()
	@IsDate()
	created_at: Date;

	@ApiProperty()
	@IsString()
	chat_link: string;
}

export class HrConnectionResponseDTo extends BaseHrConnectionDto {}
