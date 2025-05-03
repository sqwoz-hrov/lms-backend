export interface UsecaseInterface {
	execute(args: any): Promise<any>;
}
