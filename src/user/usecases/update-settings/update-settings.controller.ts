import { Body, Controller, HttpCode, HttpStatus, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { UpdateUserSettingsDto, UserSettingsDto, toUserSettingsDto } from '../../dto/user-settings.dto';
import { UpdateUserSettingsUsecase } from './update-settings.usecase';

@ApiTags('Users')
@Controller('users/settings')
@Roles('admin', 'user', 'subscriber')
export class UpdateUserSettingsController {
	constructor(private readonly updateUserSettingsUsecase: UpdateUserSettingsUsecase) {}

	@Route({
		summary: 'Обновляет персональные настройки пользователя',
		responseType: UserSettingsDto,
	})
	@Patch()
	@HttpCode(HttpStatus.OK)
	async update(@Req() req: RequestWithUser, @Body() body: UpdateUserSettingsDto): Promise<UserSettingsDto> {
		const updatedSettings = await this.updateUserSettingsUsecase.execute({
			userId: req.user.id,
			settings: body,
		});

		return toUserSettingsDto(updatedSettings);
	}
}
