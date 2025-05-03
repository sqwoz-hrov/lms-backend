import { Body, Controller, HttpCode, HttpStatus, InternalServerErrorException, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { BaseJournalRecordDto } from '../../dto/base-journal-record.dto';
import { UpdateJournalRecordDto } from '../../dto/update-journal-record.dto';
import { EditJournalRecordUsecase } from './edit-journal-record.usecase';

@ApiTags('Journal Records')
@Controller('journal-records')
@Roles('admin')
export class EditJournalRecordController {
	constructor(private readonly editUsecase: EditJournalRecordUsecase) {}

	@Route({
		summary: 'Редактирует запись журнала',
		responseType: BaseJournalRecordDto,
	})
	@Put()
	@HttpCode(HttpStatus.OK)
	async edit(@Body() dto: UpdateJournalRecordDto): Promise<BaseJournalRecordDto> {
		const record = await this.editUsecase.execute(dto);

		if (!record) {
			throw new InternalServerErrorException('Запись не отредактирована');
		}

		return record;
	}
}
