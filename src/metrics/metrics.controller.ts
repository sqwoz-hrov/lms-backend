import { Controller, Get, Header } from '@nestjs/common';
import { registry } from '../common/metrics/metrics';

@Controller('metrics')
export class MetricsController {
	constructor() {}

	@Get()
	@Header('Content-Type', 'text/plain')
	async getMetrics(): Promise<string> {
		return registry.metrics();
	}
}
