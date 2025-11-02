import { RetryableError } from '../errors/retryable.error';

export interface RetryableOptions {
	maxAttempts?: number;
	initialDelayMs?: number;
	backoffMultiplier?: number;
}

export function Retryable(options: RetryableOptions = {}): MethodDecorator {
	const { maxAttempts = 3, initialDelayMs = 250, backoffMultiplier = 2 } = options;

	return (_target, _propertyKey, descriptor: PropertyDescriptor) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const originalMethod = descriptor.value;
		if (typeof originalMethod !== 'function') {
			return descriptor;
		}

		descriptor.value = async function (...args: unknown[]) {
			let attempt = 0;
			let delay = initialDelayMs;

			while (true) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-return
					return await originalMethod.apply(this, args);
				} catch (error) {
					attempt++;
					if (error instanceof RetryableError) {
						const retryDelay = delay;

						if (attempt >= maxAttempts) {
							throw error.cause;
						}

						if (retryDelay > 0) {
							await new Promise(resolve => setTimeout(resolve, retryDelay));
						}

						delay = Math.max(0, Math.round(delay * backoffMultiplier));
						continue;
					}

					throw error;
				}
			}
		};

		return descriptor;
	};
}
