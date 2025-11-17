type AbstractSDKMethod = (args: {
	params: any;
	userMeta: UserMeta;
	headers?: Record<string, string | number>;
}) => Promise<{ status: number; body: any }>;

export type UserMetaWithoutAuth = {
	isAuth: false;
};
export type UserMetaWithAuth = {
	userId: string;
	isWrongAccessJwt: boolean;
	isWrongRefreshJwt?: boolean;
	isAuth: true;
};

export type UserMeta = UserMetaWithoutAuth | UserMetaWithAuth;

export type ValidateSDK<T> = {
	[K in keyof T]: T[K] extends AbstractSDKMethod ? T[K] : never;
};
