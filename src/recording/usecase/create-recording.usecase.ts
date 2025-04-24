import { Injectable } from '@nestjs/common';
import { RecordingRepository } from '../recording.repository';
import { Recording } from '../recording.entity';

@Injectable()
export class CreateRecordingUseCase {
  constructor(private readonly recordingRepository: RecordingRepository) {}

  async execute(recordingData: { name: string; eventTypeId: number; url: string }): Promise<Recording> {
    // You can add validation logic here
    if (!recordingData.name || !recordingData.url) {
      throw new Error('Recording name and URL are required');
    }

    return this.recordingRepository.create(recordingData);
  }
}
