import { Global, Module } from '@nestjs/common';
import { LimitsService } from './core/limits.service';
import { GetLimitsController } from './usecases/get-limits/get-limits.controller';
import { GetLimitsUsecase } from './usecases/get-limits/get-limits.usecase';
import { LimitsRepository } from './limits.repository';
import { LimitsInterceptor } from './limits.interceptor';

@Global()
@Module({
	controllers: [GetLimitsController],
	providers: [LimitsService, LimitsRepository, LimitsInterceptor, GetLimitsUsecase],
	exports: [LimitsService, LimitsRepository, LimitsInterceptor],
})
export class LimitsModule {}
