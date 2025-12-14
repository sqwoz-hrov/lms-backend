import { Global, Module } from '@nestjs/common';
import { SseController } from './sse.controller';
import { SseService } from './sse.service';

@Global()
@Module({
	controllers: [SseController],
	providers: [SseService],
	exports: [SseService],
})
export class SseModule {}
