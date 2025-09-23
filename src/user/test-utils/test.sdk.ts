import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { AskLoginDto, AskLoginResponseDto } from '../dto/ask-login.dto';
import { FinishLoginDto, FinishLoginResponseDto } from '../dto/finish-login.dto';
import { LogoutDto } from '../dto/refresh-tokens.dto';
import { CreateUserDto, UserResponseDto } from '../dto/signup.dto';

export class UsersTestSdk implements ValidateSDK<UsersTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	public async askLogin({ params, userMeta }: { params: AskLoginDto; userMeta: UserMeta }) {
		return this.testClient.request<AskLoginResponseDto>({
			path: '/users/login',
			method: 'POST',
			userMeta,
			body: params,
		});
	}

	public async finishLogin({ params, userMeta }: { params: FinishLoginDto; userMeta: UserMeta }) {
		return this.testClient.request<FinishLoginResponseDto>({
			path: '/users/login/finish',
			method: 'POST',
			userMeta,
			body: params,
		});
	}

	public async signUp({ params, userMeta }: { params: CreateUserDto; userMeta: UserMeta }) {
		return await this.testClient.request<UserResponseDto>({
			path: '/users/signup',
			method: 'POST',
			userMeta,
			body: params,
		});
	}

	public async logout({ params, userMeta }: { params: LogoutDto; userMeta: UserMeta }) {
		return this.testClient.request<{ ok: true }>({
			path: '/users/logout',
			method: 'POST',
			userMeta,
			body: params,
		});
	}

	public async refresh({ params, userMeta }: { params: { fallbackToken: string }; userMeta: UserMeta }) {
		return this.testClient.request<{ ok: true; accessTtlMs: number; refreshTtlMs: number }>({
			path: '/users/refresh',
			method: 'POST',
			userMeta,
			body: params,
		});
	}
}
