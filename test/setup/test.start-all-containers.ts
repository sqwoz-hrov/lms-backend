import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigType } from '@nestjs/config';
import { MinioContainer } from '@testcontainers/minio';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

import { dbConfig, redisConfig, s3Config } from '../../src/config';
import { runMigrations } from '../test.run-migrations';

export async function startAllContainers(
	_dbConfig: ConfigType<typeof dbConfig>,
	_redisConfig: ConfigType<typeof redisConfig>,
	_s3Config: ConfigType<typeof s3Config>,
) {
	const postgresqlContainerPromise = new PostgreSqlContainer()
		.withHostname(_dbConfig.host)
		.withExposedPorts({ container: _dbConfig.port, host: _dbConfig.port })
		.withDatabase(_dbConfig.database)
		.withUsername(_dbConfig.user)
		.withPassword(_dbConfig.password)
		.start();

	const redisContainerPromise = new RedisContainer()
		.withHostname(_redisConfig.redisHost)
		.withExposedPorts({ container: _redisConfig.redisPort, host: _redisConfig.redisPort })
		.withPassword(_redisConfig.redisPassword)
		.start();

	const apiPort = parsePort(_s3Config.endpoint) ?? 9000;

	const s3ContainerPromise = new MinioContainer('minio/minio:RELEASE.2023-09-04T19-57-37Z')
		.withEnvironment({
			MINIO_ROOT_USER: _s3Config.accessKeyId,
			MINIO_ROOT_PASSWORD: _s3Config.secretAccessKey,
		})
		.withExposedPorts({ container: 9000, host: apiPort })
		.start();

	const [postgresqlContainer, redisContainer, s3Container] = await Promise.all([
		postgresqlContainerPromise,
		redisContainerPromise,
		s3ContainerPromise,
	]);

	const s3 = new S3Client({
		region: _s3Config.region,
		endpoint: _s3Config.endpoint,
		forcePathStyle: _s3Config.forcePathStyle ?? true,
		credentials: {
			accessKeyId: _s3Config.accessKeyId,
			secretAccessKey: _s3Config.secretAccessKey,
		},
	});

	await ensureBucket(s3, _s3Config.videosHotBucketName);
	await ensureBucket(s3, _s3Config.videosColdBucketName);

	// ---- миграции
	await runMigrations({ useReal: true, connectionInfo: _dbConfig });

	const stopTestContainers = async () => {
		// стараемся останавливать всё надёжно
		await Promise.allSettled([postgresqlContainer.stop(), redisContainer.stop(), s3Container.stop()]);
	};

	return { postgresqlContainer, redisContainer, s3Container, stopTestContainers };
}

function parsePort(endpoint: string): number | null {
	try {
		const u = new URL(endpoint);
		return u.port ? Number(u.port) : u.protocol === 'http:' ? 80 : 443;
	} catch {
		return null;
	}
}

async function ensureBucket(s3: S3Client, bucket: string): Promise<void> {
	try {
		await s3.send(new CreateBucketCommand({ Bucket: bucket }));
	} catch (e) {
		const code = (e?.name || e?.Code || e?.code) as string;
		if (code === 'BucketAlreadyOwnedByYou' || code === 'BucketAlreadyExists') return;
		throw e;
	}
}
