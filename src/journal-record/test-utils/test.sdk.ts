import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { UserFactory } from '../../../test/test.user.factory';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../../config';
import { BaseJournalRecordDto } from '../dto/base-journal-record.dto';
import { CreateJournalRecordDto } from '../dto/create-journal-record.dto';
import { UpdateJournalRecordDto } from '../dto/update-journal-record.dto';
import { DeleteJournalRecordDto } from '../dto/delete-journal-record.dto';
import { GetJournalRecordsDto } from '../dto/get-journal-records.dto';

export class JournalRecordsTestSdk implements ValidateSDK<JournalRecordsTestSdk> {
	private readonly jwtFactory: UserFactory;

	constructor(
		private readonly testClient: TestHttpClient,
		jwtOptions: ConfigType<typeof jwtConfig>,
	) {
		this.jwtFactory = new UserFactory(jwtOptions);
	}

	public async createJournalRecord({ params, userMeta }: { params: CreateJournalRecordDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<BaseJournalRecordDto>({
			path: '/journal-records',
			method: 'POST',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
			body: params,
		});
	}

	public async editJournalRecord({ params, userMeta }: { params: UpdateJournalRecordDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<BaseJournalRecordDto>({
			path: '/journal-records',
			method: 'PUT',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
			body: params,
		});
	}

	public async deleteJournalRecord({ params, userMeta }: { params: DeleteJournalRecordDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<BaseJournalRecordDto>({
			path: '/journal-records',
			method: 'DELETE',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
			body: params,
		});
	}

	public async getJournalRecordInfo({ params, userMeta }: { params: { id: string }; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<BaseJournalRecordDto>({
			path: `/journal-records/${params.id}`,
			method: 'GET',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async getJournalRecords({ params, userMeta }: { params: GetJournalRecordsDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		const queryParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined) queryParams.append(key, value);
		}

		return this.testClient.request<BaseJournalRecordDto[]>({
			path: `/journal-records?${queryParams.toString()}`,
			method: 'GET',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}
}
