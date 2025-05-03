import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const imageStorageConfig = registerAs('image-storage', () => ({
	imageStorageUrl: get('IMAGE_STORAGE_URL').default('http://localhost:3001/').asUrlString(),
}));
