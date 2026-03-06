import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import {
	COLOR_THEMES,
	DEFAULT_USER_SETTINGS,
	HOMEPAGE_OPTIONS,
	UserSettings,
	ColorTheme,
	HomepagePreference,
} from '../user.entity';

export class UserSettingsDto {
	@ApiProperty({ enum: COLOR_THEMES, description: 'Preferred interface theme' })
	@IsString()
	@IsIn(COLOR_THEMES)
	theme: ColorTheme;

	@ApiProperty({ enum: HOMEPAGE_OPTIONS, description: 'Preferred landing page after login' })
	@IsString()
	@IsIn(HOMEPAGE_OPTIONS)
	homepage: HomepagePreference;
}

export class UpdateUserSettingsDto extends UserSettingsDto {}

export const toUserSettingsDto = (settings: UserSettings): UserSettingsDto => ({
	theme: settings.theme ?? DEFAULT_USER_SETTINGS.theme,
	homepage: settings.homepage ?? DEFAULT_USER_SETTINGS.homepage,
});
