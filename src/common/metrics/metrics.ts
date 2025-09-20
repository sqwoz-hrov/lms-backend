import { collectDefaultMetrics, Counter, Registry } from 'prom-client';

export const registry = new Registry();

collectDefaultMetrics({ prefix: 'lms_backend_', register: registry });

export const httpRequestsTotal = new Counter({
	name: 'lms_backend_http_requests_total',
	help: 'Количество HTTP запросов',
	labelNames: ['group'],
	registers: [registry],
});

export const httpResponsesTotal = new Counter({
	name: 'lms_backend_http_responses_total',
	help: 'Количество HTTP ответов по группам',
	labelNames: ['group'],
	registers: [registry],
});
