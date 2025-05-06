import { Readable } from 'node:stream';
import { youtube, auth as googleAuth } from '@googleapis/youtube';
import { OAuth2Client } from 'google-auth-library';
import { Inject, Logger } from '@nestjs/common';
import { youtubeConfig } from '../../config/youtube.config';
import { ConfigType } from '@nestjs/config';

export class YoutubeVideoStorageAdapter {
	private readonly logger = new Logger(YoutubeVideoStorageAdapter.name);
	private youtubeClient = youtube('v3');
	private authClient: OAuth2Client;

	constructor(
		@Inject(youtubeConfig.KEY)
		private config: ConfigType<typeof youtubeConfig>,
	) {
		this.authClient = new googleAuth.OAuth2(this.config.clientId, this.config.clientSecret);

		this.authClient.setCredentials({
			access_token: this.config.accessToken,
			refresh_token: this.config.refreshToken,
			token_type: 'Bearer',
			scope: 'https://www.googleapis.com/auth/youtube.upload',
		});
	}

	async uploadVideo({ file, title }: { file: Readable; title: string }): Promise<string> {
		try {
			await this.authClient.refreshAccessToken();
			const response = await this.youtubeClient.videos.insert({
				auth: this.authClient,
				part: ['snippet', 'status'],
				requestBody: {
					snippet: {
						title,
						categoryId: '22',
					},
					status: {
						privacyStatus: 'private',
						madeForKids: false,
					},
				},
				media: {
					body: file,
				},
			});

			const videoId = response.data.id;
			if (!videoId) {
				this.logger.error('YouTube API response missing video ID.');
				throw new Error('Missing video ID in YouTube API response');
			}

			this.logger.log(`Video uploaded successfully to YouTube. Video ID: ${videoId}`);
			return `https://www.youtube.com/watch?v=${videoId}`;
		} catch (error) {
			this.logger.error('YouTube upload failed:', error);
			throw new Error('YouTube upload failed');
		}
	}
}
