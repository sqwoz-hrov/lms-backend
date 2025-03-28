import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpStatus,
  HttpException
} from '@nestjs/common';
import { CreateRecordingUseCase } from './create-recording.usecase';
import { GetRecordingUseCase } from './get-recording.usecase';
import { UpdateRecordingUseCase } from './update-recording.usecase';
import { DeleteRecordingUseCase } from './delete-recording.usecase';
import { Recording } from '../recording.entity';
import { UpdateRecordingDto } from '../dto/update-recording.dto';
import { CreateRecordingDto } from '../dto/create-recording.dto';

@Controller('recordings')
export class RecordingController {
  constructor(
    private readonly createRecordingUseCase: CreateRecordingUseCase,
    private readonly getRecordingUseCase: GetRecordingUseCase,
    private readonly updateRecordingUseCase: UpdateRecordingUseCase,
    private readonly deleteRecordingUseCase: DeleteRecordingUseCase
  ) {}

  @Get()
  async getAllRecordings(): Promise<Recording[]> {
    try {
      return await this.getRecordingUseCase.getAll();
    } catch (error: any) {
      throw new HttpException(error?.message || 'Failed to fetch recordings', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  async getRecordingById(@Param('id', ParseIntPipe) id: number): Promise<Recording> {
    try {
      return await this.getRecordingUseCase.execute(id);
    } catch (error: any) {
      throw new HttpException(error?.message || 'Recording not found', HttpStatus.NOT_FOUND);
    }
  }

  @Get('event-type/:eventTypeId')
  async getRecordingsByEventType(@Param('eventTypeId', ParseIntPipe) eventTypeId: number): Promise<Recording[]> {
    try {
      return await this.getRecordingUseCase.getByEventType(eventTypeId);
    } catch (error: any) {
      throw new HttpException(
        error?.message || 'Failed to fetch recordings by event type',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  async createRecording(@Body() createRecordingDto: CreateRecordingDto): Promise<Recording> {
    try {
      return await this.createRecordingUseCase.execute(createRecordingDto);
    } catch (error: any) {
      throw new HttpException(error?.message || 'Failed to create recording', HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id')
  async updateRecording(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRecordingDto: UpdateRecordingDto
  ): Promise<Recording | null> {
    try {
      return await this.updateRecordingUseCase.execute(id, updateRecordingDto);
    } catch (error: any) {
      const status = error?.message?.includes('not found') ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;

      throw new HttpException(error?.message || 'Failed to update recording', status);
    }
  }

  @Delete(':id')
  async deleteRecording(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    try {
      await this.deleteRecordingUseCase.execute(id);
      return { message: `Recording with ID ${id} successfully deleted` };
    } catch (error: any) {
      const status = error?.message?.includes('not found') ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(error?.message || 'Failed to delete recording', status);
    }
  }
}
