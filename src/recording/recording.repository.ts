import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Recording } from './recording.entity';

@Injectable()
export class RecordingRepository {
  constructor(
    @InjectRepository(Recording)
    private readonly recordingRepository: Repository<Recording>
  ) {}

  async findAll(): Promise<Recording[]> {
    return this.recordingRepository.find();
  }

  async findById(id: number): Promise<Recording | null> {
    return this.recordingRepository.findOne({ where: { id } });
  }

  async findByEventTypeId(eventTypeId: number): Promise<Recording[]> {
    return this.recordingRepository.find({ where: { eventTypeId } });
  }

  async create(recordingData: Partial<Recording>): Promise<Recording> {
    const recording = this.recordingRepository.create(recordingData);
    return this.recordingRepository.save(recording);
  }

  async update(id: number, recordingData: Partial<Recording>): Promise<Recording | null> {
    await this.recordingRepository.update(id, recordingData);
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await this.recordingRepository.delete(id);
  }
}
