import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { GetJournalRecordsDto } from '../../dto/get-journal-records.dto';
import { BaseJournalRecordDto } from '../../dto/base-journal-record.dto';
import { GetJournalRecordsUsecase } from './get-journal-records.usecase';

@ApiTags('Journal Records')
@Controller('journal-records')
@Roles('admin', 'user')
export class GetJournalRecordsController {
	constructor(private readonly getUsecase: GetJournalRecordsUsecase) {}

	@Route({
		summary: 'Получает список записей журнала',
		responseType: BaseJournalRecordDto,
		isArray: true,
	})
	@Get()
	@HttpCode(HttpStatus.OK)
	async get(@Query() query: GetJournalRecordsDto): Promise<BaseJournalRecordDto[]> {
		return this.getUsecase.execute(query);
	}
}
