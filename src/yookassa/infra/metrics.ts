import { Counter } from "prom-client";
import { registry } from "../../common/metrics/metrics";

export const yookassaRequestErrorsTotal = new Counter({
	name: 'lms_backend_yookassa_request_errors_total',
	help: 'Количество ответов YooKassa с кодами 4xx/5xx',
	labelNames: ['error_code', 'request_path', 'request_method'],
	registers: [registry],
});