import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { RoleGuard } from '../guards/role.guard';
import { UserRole } from '../../../user/user.entity';

export function Roles(...roles: UserRole[]) {
	return applyDecorators(SetMetadata('roles', roles), UseGuards(RoleGuard));
}
