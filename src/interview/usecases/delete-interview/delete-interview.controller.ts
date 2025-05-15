import { Body, Controller, Delete, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { DeleteInterviewDto } from '../../dto/delete-interview.dto';
import { InterviewResponseDto } from '../../dto/base-interview.dto';
import { DeleteInterviewUsecase } from './delete-interview.usecase';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';

@ApiTags('Interviews')
@Controller('interviews')
@Roles('admin', 'user')
export class DeleteInterviewController {
	constructor(private readonly deleteUsecase: DeleteInterviewUsecase) {}

	@Route({
		summary: 'Удаляет интервью',
		responseType: InterviewResponseDto,
	})
	@Delete()
	@HttpCode(HttpStatus.OK)
	async delete(@Body() dto: DeleteInterviewDto, @Req() req: RequestWithUser): Promise<InterviewResponseDto> {
		const user = req.user;
		return await this.deleteUsecase.execute({ params: dto, user });
	}
}
