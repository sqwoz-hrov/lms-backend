const safeGuard = (arg: never, message: string = 'Safe guard executed!') => {
	throw new Error(message);
};

export const Switch = {
	safeGuard,
};
