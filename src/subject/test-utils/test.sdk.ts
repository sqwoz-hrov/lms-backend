import { ConfigType } from '@nestjs/config';
import { UserMeta, ValidateSDK } from '../../../test/test.abstract.sdk';
import { TestHttpClient } from '../../../test/test.http-client';
import { UserFactory } from '../../../test/test.user.factory';
import { jwtConfig } from '../../config';
import { SubjectResponseDto } from '../dto/base-subject.dto';
import { CreateSubjectDto } from '../dto/create-subject.dto';
import { UpdateSubjectDto } from '../dto/update-subject.dto';

export class SubjectsTestSdk implements ValidateSDK<SubjectsTestSdk> {
	private readonly jwtFactory: UserFactory;

	constructor(
		private readonly testClient: TestHttpClient,
		jwtOptions: ConfigType<typeof jwtConfig>,
	) {
		this.jwtFactory = new UserFactory(jwtOptions);
	}

	public async createSubject({ params, userMeta }: { params: CreateSubjectDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<SubjectResponseDto>({
			path: '/subjects',
			method: 'POST',
			body: params,
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async editSubject({ params, userMeta }: { params: UpdateSubjectDto; userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<SubjectResponseDto>({
			path: '/subjects',
			method: 'PUT',
			body: params,
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}

	public async getSubjects({ userMeta }: { userMeta: UserMeta }) {
		const user = this.jwtFactory.getToken(userMeta.userId);
		const jwt = userMeta.isAuth ? user.token : undefined;

		return this.testClient.request<SubjectResponseDto[]>({
			path: '/subjects',
			method: 'GET',
			jwt,
			wrongJwt: userMeta.isWrongJwt,
		});
	}
}
