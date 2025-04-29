import { LoggerService } from '@nestjs/common';

export class SilentLogger implements LoggerService {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public log(_message: string, _context?: string): void {}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public error(_message: string, _context?: string): void {}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public warn(_message: string, _context?: string): void {}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public debug(_message: string, _context?: string): void {}
}
