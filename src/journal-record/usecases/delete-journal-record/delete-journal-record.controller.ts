import { Body, Controller, Delete, HttpCode, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { BaseJournalRecordDto } from '../../dto/base-journal-record.dto';
import { DeleteJournalRecordDto } from '../../dto/delete-journal-record.dto';
import { DeleteJournalRecordUsecase } from './delete-journal-record.usecase';

@ApiTags('Journal Records')
@Controller('journal-records')
@Roles('admin')
export class DeleteJournalRecordController {
	constructor(private readonly deleteUsecase: DeleteJournalRecordUsecase) {}

	@Route({
		summary: 'Удаляет запись журнала',
		responseType: BaseJournalRecordDto,
	})
	@Delete()
	@HttpCode(HttpStatus.OK)
	async delete(@Body() dto: DeleteJournalRecordDto): Promise<BaseJournalRecordDto> {
		const record = await this.deleteUsecase.execute(dto);

		if (!record) {
			throw new InternalServerErrorException('Запись не удалена');
		}

		return record;
	}
}
