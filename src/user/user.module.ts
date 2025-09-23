import { Module } from '@nestjs/common';
import { AskForLoginController } from './usecases/ask-login/ask-login.controller';
import { FinishLoginController } from './usecases/finish-login/finish-login.controller';
import { OTPRedisStorage } from './adapters/otp-storage.adapter';
import { UserSignupAdapter } from './adapters/user-signup.adapter';
import { OTPService } from './core/otp.service';
import { AskForLoginUsecase } from './usecases/ask-login/ask-login.usecase';
import { FinishLoginUsecase } from './usecases/finish-login/finish-login.usecase';
import { SignupUsecase } from './usecases/signup/signup.usecase';
import { UserRepository } from './user.repository';
import { JwtService } from '../infra/services/jwt.service';
import { SignupController } from './usecases/signup/signup.controller';
import { GetMeController } from './usecases/get-me/get-me.controller';
import { GetMeUsecase } from './usecases/get-me/get-me.usecase';
import { GetUsersController } from './usecases/get-users/get-users.controller';
import { GetUsersUsecase } from './usecases/get-users/get-users.usecase';
import { LogoutUsecase } from './usecases/logout/logout.usecase';
import { RefreshTokensUsecase } from './usecases/refresh-tokens/refresh-tokens.usecase';
import { RefreshTokenRedisStorage } from './adapters/refresh-tokens-storage.adapter';
import { LogoutController } from './usecases/logout/logout.controller';
import { RefreshTokensController } from './usecases/refresh-tokens/refresh-tokens.controller';

@Module({
	controllers: [
		AskForLoginController,
		FinishLoginController,
		GetMeController,
		GetUsersController,
		LogoutController,
		RefreshTokensController,
		SignupController,
	],
	providers: [
		OTPRedisStorage,
		RefreshTokenRedisStorage,
		UserSignupAdapter,
		OTPService,
		JwtService,
		AskForLoginUsecase,
		FinishLoginUsecase,
		GetMeUsecase,
		GetUsersUsecase,
		LogoutUsecase,
		RefreshTokensUsecase,
		SignupUsecase,
		UserRepository,
	],
	exports: [UserSignupAdapter, UserRepository],
})
export class UserModule {}
