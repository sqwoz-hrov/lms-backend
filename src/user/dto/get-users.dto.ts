import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../user.entity';
import { UserRoles } from './user.dto';

export class GetUsersDto {
	@ApiPropertyOptional({ enum: UserRoles, isArray: true })
	@Transform(({ value }) => {
		if (value === undefined || value === null) {
			return undefined;
		}
		return Array.isArray(value) ? value.map(v => String(v)) : [String(value)];
	})
	@IsOptional()
	@IsArray()
	@IsEnum(UserRoles, { each: true })
	roles?: UserRole[];
}
