export type PrefixedValuesNullable<T, Prefix extends string> = {
	[K in keyof T as `${Prefix}${K & string}`]: T[K] | null;
};

export type PrefixedValuesRequired<T, Prefix extends string> = {
	[K in keyof T as `${Prefix}${K & string}`]: T[K];
};
