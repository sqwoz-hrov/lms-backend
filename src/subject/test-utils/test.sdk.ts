import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { SubjectResponseDto } from '../dto/base-subject.dto';
import { CreateSubjectDto } from '../dto/create-subject.dto';
import { UpdateSubjectDto } from '../dto/update-subject.dto';

export class SubjectsTestSdk implements ValidateSDK<SubjectsTestSdk> {
	constructor(private readonly testClient: TestHttpClient) {}

	public async createSubject({ params, userMeta }: { params: CreateSubjectDto; userMeta: UserMeta }) {
		return this.testClient.request<SubjectResponseDto>({
			path: '/subjects',
			method: 'POST',
			body: params,
			userMeta,
		});
	}

	public async editSubject({ params, userMeta }: { params: UpdateSubjectDto; userMeta: UserMeta }) {
		return this.testClient.request<SubjectResponseDto>({
			path: '/subjects',
			method: 'PUT',
			body: params,
			userMeta,
		});
	}

	public async getSubjects({ userMeta }: { userMeta: UserMeta }) {
		return this.testClient.request<SubjectResponseDto[]>({
			path: '/subjects',
			method: 'GET',
			userMeta,
		});
	}
}
