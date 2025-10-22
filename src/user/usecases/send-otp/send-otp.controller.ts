import { Body, Controller, HttpCode, HttpStatus, NotFoundException, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { SendOtpDto, SendOtpResponseDto } from '../../dto/send-otp.dto';
import { SendOtpUsecase } from './send-otp.usecase';

@ApiTags('Users')
@Controller('/users/signup/send-otp')
export class SendOtpController {
	constructor(private readonly sendOtpUsecase: SendOtpUsecase) {}

	@Route({
		summary: 'Отправляет OTP для завершения регистрации',
		description: 'Создает новый OTP и отправляет его в Telegram, если для пользователя привязан Telegram ID',
		responseType: SendOtpResponseDto,
	})
	@Post('/')
	@HttpCode(HttpStatus.ACCEPTED)
	public async execute(@Body() body: SendOtpDto): Promise<SendOtpResponseDto> {
		const result = await this.sendOtpUsecase.execute({ email: body.email });

		if (!result) {
			throw new NotFoundException('Пользователь с таким email не найден');
		}

		return result;
	}
}
