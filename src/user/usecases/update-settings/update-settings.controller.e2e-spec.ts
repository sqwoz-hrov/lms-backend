import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { expect } from 'chai';
import { createTestUser } from '../../../../test/fixtures/user.fixture';
import { ISharedContext } from '../../../../test/setup/test.app-setup';
import { TestHttpClient } from '../../../../test/test.http-client';
import { jwtConfig } from '../../../config';
import { DatabaseProvider } from '../../../infra/db/db.provider';
import { UpdateUserSettingsDto } from '../../dto/user-settings.dto';
import { UsersTestRepository } from '../../test-utils/test.repo';
import { UsersTestSdk } from '../../test-utils/test.sdk';

describe('[E2E] Update user settings usecase', () => {
	let app: INestApplication;
	let utilRepository: UsersTestRepository;
	let userTestSdk: UsersTestSdk;

	before(function (this: ISharedContext) {
		app = this.app;
		const kysely = app.get(DatabaseProvider);
		utilRepository = new UsersTestRepository(kysely);

		userTestSdk = new UsersTestSdk(
			new TestHttpClient(
				{
					port: 3000,
					host: 'http://127.0.0.1',
				},
				app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY),
			),
		);
	});

	afterEach(async () => {
		await utilRepository.clearAll();
	});

	it('Unauthenticated gets 401', async () => {
		const res = await userTestSdk.updateSettings({
			params: { theme: 'dark' },
			userMeta: { isAuth: false },
		});

		expect(res.status).to.equal(HttpStatus.UNAUTHORIZED);
	});

	it('Authenticated user updates settings', async () => {
		const user = await createTestUser(utilRepository);

		const res = await userTestSdk.updateSettings({
			params: { theme: 'dark' },
			userMeta: { isAuth: true, userId: user.id, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) return;
		expect(res.body).to.deep.equal({ theme: 'dark' });

		const updated = await utilRepository.connection
			.selectFrom('user')
			.select('settings')
			.where('id', '=', user.id)
			.limit(1)
			.executeTakeFirstOrThrow();

		expect(updated.settings).to.deep.equal({ theme: 'dark' });
	});

	it('Rejects invalid theme values', async () => {
		const user = await createTestUser(utilRepository);

		const res = await userTestSdk.updateSettings({
			params: { theme: 'blue' } as unknown as UpdateUserSettingsDto,
			userMeta: { isAuth: true, userId: user.id, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.BAD_REQUEST);
	});

	it('Ignores unknown fields so nothing extra is stored', async () => {
		const user = await createTestUser(utilRepository);

		const res = await userTestSdk.updateSettings({
			params: { theme: 'light', random: 'value' } as UpdateUserSettingsDto & { random: string },
			userMeta: { isAuth: true, userId: user.id, isWrongAccessJwt: false },
		});

		expect(res.status).to.equal(HttpStatus.OK);
		if (res.status !== HttpStatus.OK) return;
		expect(res.body).to.deep.equal({ theme: 'light' });

		const updated = await utilRepository.connection
			.selectFrom('user')
			.select('settings')
			.where('id', '=', user.id)
			.limit(1)
			.executeTakeFirstOrThrow();

		expect(updated.settings).to.deep.equal({ theme: 'light' });
	});
});
