export interface UsecaseInterface {
	execute(args: Record<string, unknown>): Promise<any>;
}
