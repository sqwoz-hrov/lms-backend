export const getStartOfDayUtc = (date: Date): Date => {
	const start = new Date(date);
	start.setUTCHours(0, 0, 0, 0);
	return start;
};
