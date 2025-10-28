const safeGuard = (arg: never, message: string = 'Safe guard executed!'): never => {
	throw new Error(message);
};

export const Switch = {
	safeGuard,
};
