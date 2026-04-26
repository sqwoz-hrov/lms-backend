import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Req,
	Res,
	BadRequestException,
	Headers,
	Param,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/nest/decorators/roles.decorator';
import { VideoResponseDto, VideoUploadStatusResponseDto } from '../../dto/base-video.dto';
import { RequestWithFile } from '../../../common/interface/request-with-files.interface';
import { UploadVideoUsecase } from './upload-video.usecase';
import { RouteWithFileUpload } from '../../../common/nest/decorators/file-upload-route.decorator';
import { parseContentRange } from '../../utils/parse-content-range';
import { RequestWithUser } from '../../../common/interface/request-with-user.interface';
import { Route } from '../../../common/nest/decorators/route.decorator';

@ApiTags('Videos')
@Controller('videos')
@Roles('admin', 'user')
export class UploadVideoController {
	constructor(private readonly uploadVideoUsecase: UploadVideoUsecase) {}

	@Route({
		summary: 'Возвращает состояние upload-сессии видео',
		responseType: VideoUploadStatusResponseDto,
		isArray: false,
	})
	@Get('uploads/:id')
	@HttpCode(HttpStatus.OK)
	async getStatus(@Param('id') sessionId: string, @Req() req: RequestWithUser): Promise<VideoUploadStatusResponseDto> {
		return await this.uploadVideoUsecase.getStatus({
			sessionId,
			requester: {
				id: req.user.id,
				role: req.user.role,
			},
		});
	}

	@RouteWithFileUpload({
		summary: 'Загружает видео (resumable, chunked, compressed)',
		responseType: VideoResponseDto,
	})
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(
		@Req() req: RequestWithFile & RequestWithUser,
		@Res({ passthrough: true }) res: Response,
		@Headers('upload-session-id') sessionIdHeader?: string,
		@Headers('content-range') contentRangeHeader?: string,
		@Headers('upload-chunk-size') chunkSizeHeader?: string,
	): Promise<VideoResponseDto | void> {
		if (!contentRangeHeader) {
			throw new BadRequestException('Content-Range header is required');
		}
		const cr = parseContentRange(contentRangeHeader);
		if (!cr) {
			throw new BadRequestException('Invalid Content-Range format. Expected "bytes start-end/total"');
		}

		const chunkSize = chunkSizeHeader ? Number(chunkSizeHeader) : undefined;
		if (chunkSizeHeader && (!Number.isFinite(chunkSize!) || chunkSize! <= 0)) {
			throw new BadRequestException('Upload-Chunk-Size must be a positive number');
		}

		const user = req.user;
		const file = req['parsed-file'];
		if (!file?.stream) {
			throw new BadRequestException('File stream is missing');
		}
		try {
			await file.metadataPromise;
		} catch (err) {
			if (err instanceof Error) throw err;
			throw new BadRequestException('Uploaded file is not valid');
		}

		const filename = file.filename;
		if (!filename) {
			throw new BadRequestException('Filename is required');
		}

		const declaredLength = cr.end - cr.start + 1;
		if (chunkSize && chunkSize !== declaredLength) {
			throw new BadRequestException(
				`Upload-Chunk-Size (${chunkSize}) must match Content-Range length (${declaredLength}).`,
			);
		}

		const result = await this.uploadVideoUsecase.execute({
			userId: user.id,
			sessionId: sessionIdHeader,
			stream: file.stream,
			chunk: {
				range: { start: cr.start, end: cr.end },
				totalSize: cr.total,
				length: declaredLength,
				chunkSize,
			},
			formParsePromise: file.formParsePromise,
			filename,
		});

		res.setHeader('Upload-Session-Id', result.sessionId);
		res.setHeader('Upload-Length', String(result.totalSize));
		res.setHeader('Upload-Offset', String(result.offset));
		if (result.location) {
			res.setHeader('Location', result.location);
		}

		if (result.isComplete && result.video) {
			return result.video;
		} else {
			res.status(HttpStatus.NO_CONTENT);
			return;
		}
	}
}
