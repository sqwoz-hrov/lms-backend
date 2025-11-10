import { ConsoleLogger } from '@nestjs/common';

export class SilentLogger extends ConsoleLogger {
	public override log(_message: string, _context?: string): void {}

	public override error(_message: string, _context?: string): void {}

	public override warn(_message: string, _context?: string): void {}

	public override debug(_message: string, _context?: string): void {}
}
