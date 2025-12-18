import { Controller, MessageEvent, Req, Sse, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { Roles } from '../common/nest/decorators/roles.decorator';
import { UserWithSubscriptionTier } from '../user/user.entity';
import { SseService } from './sse.service';

@Controller('sse')
export class SseController {
	constructor(private readonly sseService: SseService) {}

	@Sse('stream')
	@Roles('admin', 'user', 'subscriber')
	stream(@Req() request: Request): Observable<MessageEvent> {
		const user = request['user'] as UserWithSubscriptionTier | undefined;

		if (!user) {
			throw new UnauthorizedException('User missing in request context');
		}

		return this.sseService.subscribe(user.id);
	}
}
