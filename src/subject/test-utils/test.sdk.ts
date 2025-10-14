import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { SubjectResponseDto } from '../dto/base-subject.dto';
import { CreateSubjectDto } from '../dto/create-subject.dto';
import { UpdateSubjectDto } from '../dto/update-subject.dto';
import { OpenSubjectForTiersDto } from '../dto/open-subject-for-tiers.dto';

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

	public async getSubjects({ userMeta, query }: { userMeta: UserMeta; query?: Record<string, string> }) {
		let path = '/subjects';

		if (query && Object.keys(query).length > 0) {
			const queryParams = new URLSearchParams();

			for (const [key, value] of Object.entries(query)) {
				queryParams.append(key, value);
			}

			path = `${path}?${queryParams.toString()}`;
		}

		return this.testClient.request<SubjectResponseDto[]>({
			path,
			method: 'GET',
			userMeta,
		});
	}

	public async openSubjectForTiers({
		subjectId,
		params,
		userMeta,
	}: {
		subjectId: string;
		params: OpenSubjectForTiersDto;
		userMeta: UserMeta;
	}) {
		return this.testClient.request<void>({
			path: `/subjects/${subjectId}/open-for-tiers`,
			method: 'POST',
			body: params,
			userMeta,
		});
	}
}
