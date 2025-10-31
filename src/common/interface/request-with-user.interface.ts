import { Request } from 'express';
import { UserWithSubscriptionTier } from '../../user/user.entity';

export interface RequestWithUser extends Request {
	user: UserWithSubscriptionTier;
}
