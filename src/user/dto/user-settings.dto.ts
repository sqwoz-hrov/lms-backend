import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { COLOR_THEMES, UserSettings, ColorTheme } from '../user.entity';

export class UserSettingsDto {
	@ApiProperty({ enum: COLOR_THEMES, description: 'Preferred interface theme' })
	@IsString()
	@IsIn(COLOR_THEMES)
	theme: ColorTheme;
}

export class UpdateUserSettingsDto extends UserSettingsDto {}

export const toUserSettingsDto = (settings: UserSettings): UserSettingsDto => ({
	theme: settings.theme,
});
