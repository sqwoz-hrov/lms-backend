import { TestHttpClient } from '../../../test/test.http-client';
import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { UserRole } from '../user.entity';
import { AskLoginResponseDto } from '../usecase/dtos/ask-login.dto';
import { UserFactory } from '../../../test/test.user.factory';
import { FinishLoginResponseDto } from '../usecase/dtos/finish-login.dto';
import { UserResponseDto } from '../usecase/dtos/signup.dto';

export class UsersTestSdk implements ValidateSDK<UsersTestSdk> {
	private readonly jwtFactory: UserFactory = new UserFactory();

	constructor(private readonly testClient: TestHttpClient) {}

	public async askLogin({
		params,
		userMeta,
	}: {
		params: {
			email: string;
		};
		userMeta: UserMeta;
	}) {
		const { email } = params;
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<AskLoginResponseDto>({
			path: '/users/login',
			method: 'POST',
			wrongJwt: userMeta.isWrongJwt,
			jwt,
			body: {
				email,
			},
		});
	}

	public async finishLogin({
		params,
		userMeta,
	}: {
		params: {
			email: string;
			otpCode: number;
		};
		userMeta: UserMeta;
	}) {
		const { email, otpCode } = params;
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<FinishLoginResponseDto>({
			path: '/users/login/finish',
			method: 'POST',
			wrongJwt: userMeta.isWrongJwt,
			jwt,
			body: {
				email,
				otpCode,
			},
		});
	}

	public async signUp({
		params,
		userMeta,
	}: {
		params: {
			role: UserRole;
			name: string;
			email: string;
			telegram_username: string;
		};
		userMeta: UserMeta;
	}) {
		const { role, name, email, telegram_username } = params;
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return await this.testClient.request<UserResponseDto>({
			path: '/users/signup',
			method: 'POST',
			wrongJwt: userMeta.isWrongJwt,
			jwt,
			body: {
				role,
				name,
				email,
				telegram_username,
			},
		});
	}
}
