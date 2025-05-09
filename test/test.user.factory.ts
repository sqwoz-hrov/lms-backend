import { ConfigType } from '@nestjs/config';
import { v7 } from 'uuid';
import { JwtService } from '../src/infra/services/jwt.service';
import { jwtConfig } from '../src/config';

export class UserFactory {
	constructor(
		private readonly config: ConfigType<typeof jwtConfig> = {
			secret: 'secret',
			expiresInSeconds: 10 * 60 * 60,
		},
	) {}

	public getToken(userId: string = v7()) {
		const token = new JwtService(this.config).generate({ userId });
		return { token, userId };
	}
}
