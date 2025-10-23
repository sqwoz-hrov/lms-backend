import { Body, Controller, HttpCode, HttpStatus, Post, UnprocessableEntityException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { FinishRegistrationDto } from '../../dto/finish-registration.dto';
import { OTP } from '../../core/otp';
import { FinishRegistrationUsecase } from './finish-registration.usecase';

@ApiTags('Users')
@Controller('/users/signup/finish')
export class FinishRegistrationController {
	constructor(private readonly finishRegistrationUsecase: FinishRegistrationUsecase) {}

	@Route({
		summary: 'Завершение регистрации',
		description: 'Проверяет OTP и помечает регистрацию как завершенную',
		responseType: Object,
	})
	@Post('/')
	@HttpCode(HttpStatus.ACCEPTED)
	public async execute(@Body() body: FinishRegistrationDto) {
		const result = await this.finishRegistrationUsecase.execute({
			email: body.email,
			inputOtp: new OTP(body.otpCode),
		});

		if (!result.success) {
			throw new UnprocessableEntityException('Неправильно введён одноразовый пароль');
		}

		return { ok: true };
	}
}
