import { Controller, Get, HttpCode, HttpStatus, InternalServerErrorException, Param } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { BaseJournalRecordDto } from '../../dto/base-journal-record.dto';
import { GetJournalRecordInfoUsecase } from './get-journal-record-info.usecase';

@ApiTags('Journal Records')
@Controller('journal-records')
@Roles('admin')
export class GetJournalRecordInfoController {
	constructor(private readonly getUsecase: GetJournalRecordInfoUsecase) {}

	@Route({
		summary: 'Возвращает одну запись журнала',
		responseType: BaseJournalRecordDto,
	})
	@ApiParam({ name: 'id', required: true })
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	async getById(@Param('id') id: string): Promise<BaseJournalRecordDto> {
		const record = await this.getUsecase.execute({ id });

		if (!record) {
			throw new InternalServerErrorException('Запись не найдена');
		}

		return record;
	}
}
