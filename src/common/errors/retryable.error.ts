export class RetryableError<TCause = unknown> extends Error {
	public readonly cause: TCause;

	constructor(message: string, cause: TCause) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype);
		this.name = 'RetryableError';

		this.cause = cause;
		if (cause instanceof Error && cause.stack) {
			this.stack = cause.stack;
		}
	}
}
