import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const youtubeConfig = registerAs('youtube', () => ({
	clientId: get('YOUTUBE_CLIENT_ID').required().asString(),
	clientSecret: get('YOUTUBE_CLIENT_SECRET').required().asString(),
	accessToken: get('YOUTUBE_ACCESS_TOKEN').required().asString(),
	refreshToken: get('YOUTUBE_REFRESH_TOKEN').required().asString(),
}));
