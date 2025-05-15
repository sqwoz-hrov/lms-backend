import { Body, Controller, HttpCode, HttpStatus, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { UpdateInterviewDto } from '../../dto/update-interview.dto';
import { InterviewResponseDto } from '../../dto/base-interview.dto';
import { EditInterviewUsecase } from './edit-interview.usecase';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('Interviews')
@Controller('interviews')
@Roles('admin', 'user')
export class EditInterviewController {
	constructor(private readonly editUsecase: EditInterviewUsecase) {}

	@Route({
		summary: 'Редактирует интервью',
		responseType: InterviewResponseDto,
	})
	@Put()
	@HttpCode(HttpStatus.OK)
	async update(@Body() dto: UpdateInterviewDto, @Req() req: RequestWithUser): Promise<InterviewResponseDto> {
		const user = req.user;
		return await this.editUsecase.execute({ params: dto, user });
	}
}
