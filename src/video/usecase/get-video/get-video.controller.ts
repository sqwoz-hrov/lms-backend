import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { Route } from '../../../common/nest/decorators/route.decorator';
import { VideoResponseDto } from '../../dto/base-video.dto';
import { GetVideoUsecase } from './get-video.usecase';

@ApiTags('Videos')
@Controller('videos')
@Roles('admin', 'user', 'subscriber')
export class GetVideoController {
	constructor(private readonly getVideoUsecase: GetVideoUsecase) {}

	@Route({
		summary: 'Получает список контактов с HR',
		responseType: VideoResponseDto,
		isArray: false,
	})
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	async get(@Param('id') id: string, @Req() req: RequestWithUser): Promise<VideoResponseDto> {
		const user = req['user'];
		const video = await this.getVideoUsecase.execute({ video_id: id, user });

		if (!video) {
			throw new NotFoundException('Видео не найдено');
		}

		return video;
	}
}
