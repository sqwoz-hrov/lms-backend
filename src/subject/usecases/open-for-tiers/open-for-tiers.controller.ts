import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { OpenSubjectForTiersDto } from '../../dto/open-subject-for-tiers.dto';
import { OpenSubjectForTiersUsecase } from './open-for-tiers.usecase';

@ApiTags('Subjects')
@Controller('subjects')
@Roles('admin')
export class OpenSubjectForTiersController {
	constructor(private readonly openSubjectForTiersUsecase: OpenSubjectForTiersUsecase) {}

	@Route({
		summary: 'Открывает доступ к предмету для подписочных уровней',
		responseType: Object,
	})
	@Post(':id/open-for-tiers')
	@HttpCode(HttpStatus.CREATED)
	async open(@Param('id') subjectId: string, @Body() dto: OpenSubjectForTiersDto): Promise<void> {
		await this.openSubjectForTiersUsecase.execute({
			subjectId,
			tierIds: dto.tier_ids,
		});
	}
}
