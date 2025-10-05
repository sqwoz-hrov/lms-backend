import { TransformFnParams } from 'class-transformer';

export function strictToBoolean({ value }: TransformFnParams): boolean {
	if (typeof value === 'boolean') return value;

	if (typeof value === 'string') {
		const v = value.trim().toLowerCase();
		if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
		if (v === 'false' || v === '0' || v === 'no' || v === 'off' || v === '') return false;
	}

	if (typeof value === 'number') {
		if (value === 1) return true;
		if (value === 0) return false;
	}

	return value as boolean;
}
