import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { RoleGuard } from '../guards/role.guard';

export function Roles(...roles: string[]) {
	return applyDecorators(SetMetadata('roles', roles), UseGuards(RoleGuard));
}
