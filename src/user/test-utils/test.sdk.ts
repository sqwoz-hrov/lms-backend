import { TestHttpClient } from '../../../test/test.http-client';
import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { UserFactory } from '../../../test/test.user.factory';
import { FinishLoginDto, FinishLoginResponseDto } from '../dto/finish-login.dto';
import { AskLoginDto, AskLoginResponseDto } from '../dto/ask-login.dto';
import { CreateUserDto, UserResponseDto } from '../dto/signup.dto';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../../config';

export class UsersTestSdk implements ValidateSDK<UsersTestSdk> {
	private readonly jwtFactory: UserFactory;

	constructor(
		private readonly testClient: TestHttpClient,
		jwtOptions: ConfigType<typeof jwtConfig>,
	) {
		this.jwtFactory = new UserFactory(jwtOptions);
	}

	public async askLogin({ params, userMeta }: { params: AskLoginDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<AskLoginResponseDto>({
			path: '/users/login',
			method: 'POST',
			wrongJwt: userMeta.isWrongJwt,
			jwt,
			body: params,
		});
	}

	public async finishLogin({ params, userMeta }: { params: FinishLoginDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<FinishLoginResponseDto>({
			path: '/users/login/finish',
			method: 'POST',
			wrongJwt: userMeta.isWrongJwt,
			jwt,
			body: params,
		});
	}

	public async signUp({ params, userMeta }: { params: CreateUserDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return await this.testClient.request<UserResponseDto>({
			path: '/users/signup',
			method: 'POST',
			wrongJwt: userMeta.isWrongJwt,
			jwt,
			body: params,
		});
	}
}
