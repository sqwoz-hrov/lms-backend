import { Controller, Body, Post, NotFoundException, HttpCode, HttpStatus } from '@nestjs/common';
import { AskForLoginUsecase } from './ask-login.usecase';
import { AskLoginDto, AskLoginResponseDto } from '../../dto/ask-login.dto';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { ApiTags } from '@nestjs/swagger';

const NOT_FOUND_ERROR_MESSAGE = 'Пользователя с такой почтой не нашлось :( Проверьте почту или напишите нам';

@ApiTags('Users')
@Controller('/users/login')
export class AskForLoginController {
	constructor(private readonly askForLoginUsecase: AskForLoginUsecase) {}

	@Route({
		summary: 'Начинает процедуру логина, отправляя OTP на указанную почту',
		description: 'Идемпотентная, можно хоть 20 раз нажать',
		responseType: AskLoginResponseDto,
		possibleErrors: [
			{
				status: HttpStatus.NOT_FOUND,
				description: 'Пользователя с такой почтой не нашлось',
				schema: {
					type: 'object',
					properties: {
						message: {
							type: 'string',
							description: 'Сообщение об ошибке',
							enum: [NOT_FOUND_ERROR_MESSAGE],
						},
					},
				},
			},
		],
	})
	@Post('/')
	@HttpCode(HttpStatus.ACCEPTED)
	public async execute(@Body() body: AskLoginDto) {
		const res = await this.askForLoginUsecase.execute({ emailOrLogin: body.email });

		if (!res.success) {
			throw new NotFoundException(NOT_FOUND_ERROR_MESSAGE);
		}

		return {};
	}
}
