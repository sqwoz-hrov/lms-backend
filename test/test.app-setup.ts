import { DynamicModule, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { InfraModule } from '../src/infra/infra.module';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { dbConfig, imageStorageConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig } from '../src/config';
import { runMigrations } from './test.run-migrations';
import { SilentLogger } from './test.silent-logger';

export const setupTestApplication = async ({
	imports,
	useSilentLogger,
}: {
	imports: (DynamicModule | Type<any>)[];
	useSilentLogger?: boolean;
}) => {
	process.env.REDIS_USERNAME = '';

	if (useSilentLogger === undefined) {
		useSilentLogger = true;
	}

	const testModule = await Test.createTestingModule({
		imports: [
			InfraModule,
			ConfigModule.forRoot({
				load: [dbConfig, imageStorageConfig, jwtConfig, otpBotConfig, otpConfig, redisConfig],
				isGlobal: true,
				envFilePath: '.env.test',
			}),
			...imports,
		],
	}).compile();

	const app = testModule.createNestApplication();

	if (useSilentLogger) app.useLogger(new SilentLogger());

	const _dbConfig = app.get<ConfigType<typeof dbConfig>>(dbConfig.KEY);
	const _redisConfig = app.get<ConfigType<typeof redisConfig>>(redisConfig.KEY);

	const postgresqlContainer = await new PostgreSqlContainer()
		.withHostname(_dbConfig.host)
		.withExposedPorts({ container: _dbConfig.port, host: _dbConfig.port })
		.withDatabase(_dbConfig.database)
		.withUsername(_dbConfig.user)
		.withPassword(_dbConfig.password)
		.start();

	const redisContainer = await new RedisContainer()
		.withHostname(_redisConfig.redisHost)
		.withExposedPorts({ container: _redisConfig.redisPort, host: _redisConfig.redisPort })
		.withUser('') // It doesn't actually support username
		.withPassword(_redisConfig.redisPassword)
		.start();

	await runMigrations({ useReal: true, connectionInfo: _dbConfig });

	const shutdown = async () => {
		await app.close();
		await postgresqlContainer.stop();
		await redisContainer.stop();
	};

	return { app, postgresqlContainer, redisContainer, shutdown };
};
