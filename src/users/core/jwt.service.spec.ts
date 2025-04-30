import { expect } from 'chai';
import { sign } from 'jsonwebtoken';
import { v7 } from 'uuid';

import { JwtService } from './jwt.service';

const secret = 'secret';

const jwtService = new JwtService({
	secret,
	expiresInSeconds: 60,
});

const rubbishJwtService = {
	generate: ({
		expiryMs,
		secret,
		algorithm,
		userId,
		payload,
		noExp,
	}: {
		expiryMs?: number;
		secret?: string;
		algorithm?: 'HS512' | 'HS256';
		userId?: string;
		payload?: Record<string, string | number | boolean>;
		noExp?: boolean;
	}) => {
		const fallbackSecret = 'AWDHJWAKLDJWAOLIDUJAWIOLDJAWLKDJAWDLAWD';
		const fallbackAlgorithm = 'HS512';
		const fallbackExpiry = Date.now() + 1000 * 60 * 60; // 1 hour
		const fallbackUserId = v7();
		const noExpPayload = noExp || false;

		const preparedPayload = payload ?? { userId: userId ?? fallbackUserId };

		const token = sign({ ...preparedPayload }, secret ?? fallbackSecret, {
			...(noExpPayload ? {} : { expiresIn: `${expiryMs ?? fallbackExpiry}` }),
			algorithm: algorithm ?? fallbackAlgorithm,
		});

		return token;
	},
};

describe('JwtService', () => {
	it('Expired token should not verify', async () => {
		const userId = v7();

		const expiredToken = rubbishJwtService.generate({
			expiryMs: 1,
			userId,
			secret,
		});

		await new Promise(resolve => setTimeout(resolve, 20));

		const result = await jwtService.verify(expiredToken);
		expect(result).to.deep.equal({ success: false });
	});
	it('Wrong sign alg token should not verify', async () => {
		const userId = v7();

		const expiredToken = rubbishJwtService.generate({
			userId,
			secret,
			algorithm: 'HS256',
		});

		const result = await jwtService.verify(expiredToken);
		expect(result).to.deep.equal({ success: false });
	});
	it('Fake signature should not verify', async () => {
		const userId = v7();
		const fakeSignatureToken = rubbishJwtService.generate({
			expiryMs: 1000 * 60,
			userId,
		});

		const result = await jwtService.verify(fakeSignatureToken);
		expect(result).to.deep.equal({ success: false });
	});

	it('Invalid payload should not verify', async () => {
		const userId = v7();
		const fakeSignatureToken = rubbishJwtService.generate({
			expiryMs: 1000 * 60,
			userId,
			secret,
			payload: { test: 'test' },
		});

		const result = await jwtService.verify(fakeSignatureToken);
		expect(result).to.deep.equal({ success: false });
	});

	it('Extended payload should not verify', async () => {
		const userId = v7();
		const fakeSignatureToken = rubbishJwtService.generate({
			expiryMs: 1000 * 60,
			userId,
			secret,
			payload: { userId, test: 'test' },
		});

		const result = await jwtService.verify(fakeSignatureToken);
		expect(result).to.deep.equal({ success: false });
	});

	it('Empty payload should not verify', async () => {
		const userId = v7();
		const fakeSignatureToken = rubbishJwtService.generate({
			expiryMs: 1000 * 60,
			userId,
			secret,
			payload: {},
		});

		const result = await jwtService.verify(fakeSignatureToken);
		expect(result).to.deep.equal({ success: false });
	});

	it('No expiry should not verify', async () => {
		const userId = v7();
		const noExpiryToken = rubbishJwtService.generate({
			userId,
			secret,
			noExp: true,
		});

		const result = await jwtService.verify(noExpiryToken);
		expect(result).to.deep.equal({ success: false });
	});

	it('No userId should not verify', async () => {
		const noUserIdToken = rubbishJwtService.generate({
			userId: undefined,
			secret,
			payload: {},
		});

		const result = await jwtService.verify(noUserIdToken);
		expect(result).to.deep.equal({ success: false });
	});

	it('Valid token should verify', async () => {
		const userId = v7();
		const validToken = rubbishJwtService.generate({
			userId,
			secret,
		});
		const result = await jwtService.verify(validToken);
		expect(result).to.have.property('success').to.equal(true);
		expect(result).to.have.property('data').and.to.have.property('userId').to.equal(userId);
		expect(result)
			.to.have.property('data')
			.and.to.have.property('expires')
			.to.be.greaterThan(Date.now() / 1000);
	});
});
