import { Request } from 'express';
import { UserWithNullableSubscriptionTier } from '../../user/user.entity';

export interface RequestWithUserNullableSubscriptionTier extends Request {
	user: UserWithNullableSubscriptionTier;
}
