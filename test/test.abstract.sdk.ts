type AbstractSDKMethod = (args: { params: any; userMeta: UserMeta }) => Promise<{ status: number; body: any }>;

export type UserMeta = {
	userId: string;
	isWrongJwt: boolean;
	isAuth: boolean;
};

export type ValidateSDK<T> = {
	[K in keyof T]: T[K] extends AbstractSDKMethod ? T[K] : never;
};
