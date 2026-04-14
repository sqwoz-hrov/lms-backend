import { SetMetadata, UseInterceptors, applyDecorators } from '@nestjs/common';
import { LimitableResource } from '../core/limits.domain';
import { LimitsInterceptor } from '../limits.interceptor';

export const LIMIT_FEATURE_METADATA_KEY = Symbol.for('limits:feature');

export const LimitByFeature = (feature: LimitableResource) =>
	applyDecorators(SetMetadata(LIMIT_FEATURE_METADATA_KEY, feature), UseInterceptors(LimitsInterceptor));
