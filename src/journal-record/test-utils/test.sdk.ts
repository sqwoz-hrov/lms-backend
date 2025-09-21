import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { BaseJournalRecordDto } from '../dto/base-journal-record.dto';
import { CreateJournalRecordDto } from '../dto/create-journal-record.dto';
import { DeleteJournalRecordDto } from '../dto/delete-journal-record.dto';
import { GetJournalRecordsDto } from '../dto/get-journal-records.dto';
import { UpdateJournalRecordDto } from '../dto/update-journal-record.dto';

export class JournalRecordsTestSdk implements ValidateSDK<JournalRecordsTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	public async createJournalRecord({ params, userMeta }: { params: CreateJournalRecordDto; userMeta: UserMeta }) {
		return this.testClient.request<BaseJournalRecordDto>({
			path: '/journal-records',
			method: 'POST',
			userMeta,
			body: params,
		});
	}

	public async editJournalRecord({ params, userMeta }: { params: UpdateJournalRecordDto; userMeta: UserMeta }) {
		return this.testClient.request<BaseJournalRecordDto>({
			path: '/journal-records',
			method: 'PUT',
			userMeta,
			body: params,
		});
	}

	public async deleteJournalRecord({ params, userMeta }: { params: DeleteJournalRecordDto; userMeta: UserMeta }) {
		return this.testClient.request<BaseJournalRecordDto>({
			path: '/journal-records',
			method: 'DELETE',
			userMeta,
			body: params,
		});
	}

	public async getJournalRecordInfo({ params, userMeta }: { params: { id: string }; userMeta: UserMeta }) {
		return this.testClient.request<BaseJournalRecordDto>({
			path: `/journal-records/${params.id}`,
			method: 'GET',
			userMeta,
		});
	}

	public async getJournalRecords({ params, userMeta }: { params: GetJournalRecordsDto; userMeta: UserMeta }) {
		const queryParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined) queryParams.append(key, value);
		}

		return this.testClient.request<BaseJournalRecordDto[]>({
			path: `/journal-records?${queryParams.toString()}`,
			method: 'GET',
			userMeta,
		});
	}
}
