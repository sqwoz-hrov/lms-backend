import { Controller, Body, Post, HttpCode, HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import { FinishLoginUsecase } from './finish-login.usecase';
import { FinishLoginDto, FinishLoginResponseDto } from '../../dto/finish-login.dto';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { ApiTags } from '@nestjs/swagger';
import { OTP } from '../../core/otp';

const UNPROCESSABLE_ENTITY_ERROR_MESSAGE = 'Неправильно введён одноразовый пароль';

@ApiTags('Users')
@Controller('/users/login/finish')
export class FinishLoginController {
	constructor(private readonly finishLoginUsecase: FinishLoginUsecase) {}

	@Route({
		summary: 'Завершение логина',
		description: 'Завершение логина',
		responseType: FinishLoginResponseDto,
		possibleErrors: [
			{
				status: HttpStatus.UNPROCESSABLE_ENTITY,
				description: 'Неверный код',
				schema: {
					type: 'object',
					properties: {
						message: {
							enum: [UNPROCESSABLE_ENTITY_ERROR_MESSAGE],
							type: 'string',
							example: UNPROCESSABLE_ENTITY_ERROR_MESSAGE,
						},
					},
				},
			},
		],
	})
	@Post('/')
	@HttpCode(HttpStatus.ACCEPTED)
	public async execute(@Body() body: FinishLoginDto) {
		const res = await this.finishLoginUsecase.execute({
			userEmailOrLogin: body.email,
			inputOtp: new OTP(body.otpCode),
		});

		if (!res.success) {
			throw new UnprocessableEntityException(UNPROCESSABLE_ENTITY_ERROR_MESSAGE);
		}

		return { token: res.data.token };
	}
}
