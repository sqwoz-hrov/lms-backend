import { expect } from 'chai';
import { sign } from 'jsonwebtoken';
import { v7 } from 'uuid';
import { JwtService } from './jwt.service';

const secret = 'secret';

const jwtService = new JwtService({
	accessSecret: secret,
	accessExpiresInSeconds: 60,
	refreshExpiresInSeconds: 3600,
});

const customTokenFactory = {
	generate: ({
		expiryMs,
		secretOverride,
		algorithm,
		userId,
		payload,
		noExp,
	}: {
		expiryMs?: number;
		secretOverride?: string;
		algorithm?: 'HS512' | 'HS256';
		userId?: string;
		payload?: Record<string, unknown>;
		noExp?: boolean;
	}) => {
		const fallbackSecret = 'SUPER_SECRET';
		const fallbackAlgorithm = 'HS512';
		const fallbackUserId = userId ?? v7();

		const finalPayload = payload ?? {
			userId: fallbackUserId,
			type: 'access',
		};

		const token = sign(finalPayload, secretOverride ?? fallbackSecret, {
			...(noExp ? {} : { expiresIn: `${expiryMs ?? 1000 * 60}` }),
			algorithm: algorithm ?? fallbackAlgorithm,
		});

		return token;
	},
};

describe('JwtService', () => {
	it('Expired token should not verify', async () => {
		const userId = v7();

		const expiredToken = customTokenFactory.generate({
			expiryMs: 1,
			userId,
			secretOverride: secret,
		});

		await new Promise(r => setTimeout(r, 10));

		const result = await jwtService.verify(expiredToken);
		expect(result).to.deep.equal({ success: false });
	});

	it('Wrong sign algorithm should not verify', async () => {
		const userId = v7();

		const wrongAlgToken = customTokenFactory.generate({
			userId,
			secretOverride: secret,
			algorithm: 'HS256', // неверный алгоритм
		});

		const result = await jwtService.verify(wrongAlgToken);
		expect(result).to.deep.equal({ success: false });
	});

	it('Fake signature should not verify', async () => {
		const userId = v7();

		const fakeToken = customTokenFactory.generate({
			userId,
			// secretOverride отсутствует — подпись другая
		});

		const result = await jwtService.verify(fakeToken);
		expect(result).to.deep.equal({ success: false });
	});

	it('Invalid payload (no userId) should not verify', async () => {
		const token = customTokenFactory.generate({
			secretOverride: secret,
			payload: { type: 'access' }, // нет userId
		});

		const result = await jwtService.verify(token);
		expect(result).to.deep.equal({ success: false });
	});

	it('Extended payload should not verify', async () => {
		const userId = v7();
		const token = customTokenFactory.generate({
			secretOverride: secret,
			payload: { userId, type: 'access', extra: 'bad' },
		});

		const result = await jwtService.verify(token);
		expect(result).to.deep.equal({ success: false });
	});

	it('No expiry should not verify', async () => {
		const userId = v7();

		const tokenWithoutExp = customTokenFactory.generate({
			userId,
			secretOverride: secret,
			noExp: true,
		});

		const result = await jwtService.verify(tokenWithoutExp);
		expect(result).to.deep.equal({ success: false });
	});

	it('Valid access token should verify', async () => {
		const { accessToken } = jwtService.generatePair({ userId: v7() });

		const result = await jwtService.verify(accessToken);
		expect(result.success).to.equal(true);
		if (result.success) {
			expect(result.data.type).to.equal('access');
			expect(result.data.userId).to.be.a('string');
			expect(result.data.exp).to.be.greaterThan(Math.floor(Date.now() / 1000));
		}
	});

	it('Valid refresh token should verify and have jti', async () => {
		const { refreshToken } = jwtService.generatePair({ userId: v7() });

		const result = await jwtService.verify(refreshToken);
		expect(result.success).to.equal(true);
		if (result.success) {
			expect(result.data).to.have.property('type').to.equal('refresh');
			expect(result.data).to.have.property('jti').to.be.a('string');
		}
	});
});
