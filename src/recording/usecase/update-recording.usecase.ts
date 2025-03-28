import { Injectable } from '@nestjs/common';
import { RecordingRepository } from '../recording.repository';
import { Recording } from '../recording.entity';

@Injectable()
export class UpdateRecordingUseCase {
  constructor(private readonly recordingRepository: RecordingRepository) {}

  async execute(id: number, recordingData: Partial<Recording>): Promise<Recording | null> {
    // First check if the recording exists
    const existingRecording = await this.recordingRepository.findById(id);

    if (!existingRecording) {
      throw new Error(`Recording with ID ${id} not found`);
    }

    // You can add additional validation logic here
    if (recordingData.name === '') {
      throw new Error('Recording name cannot be empty');
    }

    return this.recordingRepository.update(id, recordingData);
  }
}
