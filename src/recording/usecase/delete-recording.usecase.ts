import { Injectable } from '@nestjs/common';
import { RecordingRepository } from '../recording.repository';

@Injectable()
export class DeleteRecordingUseCase {
	constructor(private readonly recordingRepository: RecordingRepository) {}

	async execute(id: number): Promise<void> {
		// First check if the recording exists
		const existingRecording = await this.recordingRepository.findById(id);

		if (!existingRecording) {
			throw new Error(`Recording with ID ${id} not found`);
		}

		// You might want to add additional logic here
		// For example, check if this recording is referenced elsewhere

		await this.recordingRepository.delete(id);
	}
}
