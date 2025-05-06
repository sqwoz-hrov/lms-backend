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

@Module({
	controllers: [AskForLoginController, FinishLoginController, SignupController],
	providers: [
		OTPRedisStorage,
		UserSignupAdapter,
		OTPService,
		JwtService,
		AskForLoginUsecase,
		FinishLoginUsecase,
		SignupUsecase,
		UserRepository,
	],
	exports: [UserSignupAdapter, UserRepository],
})
export class UserModule {}
