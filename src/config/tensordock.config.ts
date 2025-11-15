import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const tensordockConfig = registerAs('tensordock', () => ({
	apiUrl: get('TENSORDOCK_API_URL').default('https://dashboard.tensordock.com/api/v2').asString(),
	token: get('TENSORDOCK_TOKEN').required().asString(),
	vmId: get('TENSORDOCK_VM_ID').required().asString(),
}));
