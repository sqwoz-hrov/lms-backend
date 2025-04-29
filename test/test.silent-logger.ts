import { ConsoleLogger } from '@nestjs/common';

export class SilentLogger extends ConsoleLogger {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public override log(_message: string, _context?: string): void {}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public override error(_message: string, _context?: string): void {}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public override warn(_message: string, _context?: string): void {}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public override debug(_message: string, _context?: string): void {}
}
