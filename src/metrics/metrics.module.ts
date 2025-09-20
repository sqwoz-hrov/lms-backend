import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from '../common/nest/middlewares/http-metrics-middleware';

@Module({
	controllers: [MetricsController],
})
export class MetricsModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(MetricsMiddleware).forRoutes('*');
	}
}
