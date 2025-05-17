import { Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { VideoResponseDto } from '../../dto/base-video.dto';
import { RequestWithFile } from '../../../common/interface/request-with-files.interface';
import { UploadVideoUsecase } from './upload-video.usecase';
import { RouteWithFileUpload } from '../../../common/nest/decorators/file-upload-route.decorator';

@ApiTags('Videos')
@Controller('videos')
@Roles('admin', 'user')
export class UploadVideoController {
	constructor(private readonly uploadVideoUsecase: UploadVideoUsecase) {}

	@RouteWithFileUpload({
		summary: 'Загружает видео',
		responseType: VideoResponseDto,
	})
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(@Req() req: RequestWithFile): Promise<VideoResponseDto> {
		const file = req['parsed-file'];
		return await this.uploadVideoUsecase.execute({ stream: file.stream });
	}
}
