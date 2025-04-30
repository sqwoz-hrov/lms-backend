import { Module } from '@nestjs/common';
import { AskForLoginController } from './usecase/ask-login/ask-login.controller';
import { FinishLoginController } from './usecase/finish-login/finish-login.controller';
import { OTPRedisStorage } from './adapters/otp-storage.adapter';
import { UserSignupAdapter } from './adapters/user-signup.adapter';
import { OTPService } from './core/otp.service';
import { AskForLoginUsecase } from './usecase/ask-login/ask-login.usecase';
import { FinishLoginUsecase } from './usecase/finish-login/finish-login.usecase';
import { SignupUsecase } from './usecase/signup/signup.usecase';
import { UserRepository } from './user.repository';
import { JwtService } from './core/jwt.service';

import { SignupController } from './usecase/signup/signup.controller';

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
	exports: [UserSignupAdapter],
})
export class UserModule {}
