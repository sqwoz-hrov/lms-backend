import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { AskLoginDto, AskLoginResponseDto } from '../dto/ask-login.dto';
import { FinishLoginDto, FinishLoginResponseDto } from '../dto/finish-login.dto';
import { FinishRegistrationDto } from '../dto/finish-registration.dto';
import { LogoutDto } from '../dto/refresh-tokens.dto';
import { CreateUserDto, UserResponseDto } from '../dto/user.dto';
import { PublicSignupDto } from '../dto/user.dto';
import { SendOtpDto, SendOtpResponseDto } from '../dto/send-otp.dto';
import { UpdateUserSettingsDto, UserSettingsDto } from '../dto/user-settings.dto';
import { UserRole } from '../user.entity';

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

	public async finishRegistration({ params, userMeta }: { params: FinishRegistrationDto; userMeta: UserMeta }) {
		return this.testClient.request<{ ok: true }>({
			path: '/users/signup/finish',
			method: 'POST',
			userMeta,
			body: params,
		});
	}

	public async adminSignUp({ params, userMeta }: { params: CreateUserDto; userMeta: UserMeta }) {
		return await this.testClient.request<UserResponseDto>({
			path: '/users/admin-signup',
			method: 'POST',
			userMeta,
			body: params,
		});
	}

	public async publicSignUp({ params, userMeta }: { params: PublicSignupDto; userMeta: UserMeta }) {
		return await this.testClient.request<UserResponseDto>({
			path: '/users/signup',
			method: 'POST',
			userMeta,
			body: params,
		});
	}

	public async sendSignupOtp({ params, userMeta }: { params: SendOtpDto; userMeta: UserMeta }) {
		return await this.testClient.request<SendOtpResponseDto>({
			path: '/users/send-otp',
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

	public async getUserById({ params, userMeta }: { params: { id: string }; userMeta: UserMeta }) {
		return this.testClient.request<UserResponseDto>({
			path: `/users/${params.id}`,
			method: 'GET',
			userMeta,
		});
	}

	public async getUsers({ userMeta, params }: { userMeta: UserMeta; params?: { roles?: UserRole[] } }) {
		const searchParams = new URLSearchParams();
		if (params?.roles?.length) {
			for (const role of params.roles) {
				searchParams.append('roles', role);
			}
		}
		const queryString = searchParams.toString();

		return this.testClient.request<UserResponseDto[]>({
			path: `/users${queryString ? `?${queryString}` : ''}`,
			method: 'GET',
			userMeta,
		});
	}

	public async getMe({ userMeta }: { userMeta: UserMeta }) {
		return this.testClient.request<UserResponseDto>({
			path: '/users/get-me',
			method: 'GET',
			userMeta,
		});
	}

	public async updateSettings({ params, userMeta }: { params: UpdateUserSettingsDto; userMeta: UserMeta }) {
		return this.testClient.request<UserSettingsDto>({
			path: '/users/settings',
			method: 'PATCH',
			userMeta,
			body: params,
		});
	}
}
