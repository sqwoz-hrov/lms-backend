import { Body, Controller, HttpCode, HttpStatus, InternalServerErrorException, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { BaseJournalRecordDto } from '../../dto/base-journal-record.dto';
import { CreateJournalRecordDto } from '../../dto/create-journal-record.dto';
import { CreateJournalRecordUsecase } from './create-journal-record.usecase';

@ApiTags('Journal Records')
@Controller('journal-records')
@Roles('admin')
export class CreateJournalRecordController {
	constructor(private readonly createUsecase: CreateJournalRecordUsecase) {}

	@Route({
		summary: 'Создает запись журнала',
		responseType: BaseJournalRecordDto,
	})
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(@Body() dto: CreateJournalRecordDto): Promise<BaseJournalRecordDto> {
		const record = await this.createUsecase.execute(dto);

		if (!record) {
			throw new InternalServerErrorException('Запись не создана');
		}

		return record;
	}
}
