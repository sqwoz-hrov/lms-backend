import { ConfigType } from '@nestjs/config';
import { v7 } from 'uuid';

import { JwtService } from '../src/users/core/jwt.service';
import { jwtConfig } from '../src/config';
import { SilentLogger } from './test.silent-logger';

export class UserFactory {
	constructor(
		private readonly config: ConfigType<typeof jwtConfig> = {
			secret: 'secret',
			expiresInSeconds: 10 * 60 * 60,
		},
	) {}

	public getToken(userId: string = v7()) {
		const silentLogger = new SilentLogger();
		const token = new JwtService(this.config, silentLogger).generate({ userId });
		return { token, userId };
	}
}
