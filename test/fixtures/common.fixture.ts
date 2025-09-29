import { randomBytes } from 'crypto';

export const randomWord = () => {
	const buf = randomBytes(4);
	const word = buf.toString('hex');
	return word;
};

export const randomNumericId = () => {
	const buf = randomBytes(1);
	const idHex = buf.toString('hex');
	const id = parseInt(idHex, 16);
	return id;
};
