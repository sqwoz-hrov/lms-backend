export class OTP {
	private readonly digits: number;

	private static validate(digits: number) {
		return digits <= 999999 && digits >= 100000;
	}

	constructor(digitsOrString: string | number | undefined) {
		if (!digitsOrString) {
			throw new Error('Cannot instantiate empty OTP');
		}

		const digits = typeof digitsOrString === 'string' ? parseInt(digitsOrString, 10) : digitsOrString;

		const isOk = OTP.validate(digits);

		if (isOk) {
			return this;
		}

		throw new Error('OTP messed up');
	}

	get asNumber() {
		return this.digits;
	}

	get asString() {
		return this.digits.toString();
	}

	public isEqual(otherOtp: OTP) {
		return this.asString === otherOtp.asString;
	}
}
