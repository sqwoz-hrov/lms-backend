import { Injectable } from '@nestjs/common';
import { RecordingRepository } from '../recording.repository';
import { Recording } from '../recording.entity';

@Injectable()
export class GetRecordingUseCase {
	constructor(private readonly recordingRepository: RecordingRepository) {}

	async execute(id: number): Promise<Recording> {
		const recording = await this.recordingRepository.findById(id);

		if (!recording) {
			throw new Error(`Recording with ID ${id} not found`);
		}

		return recording;
	}

	async getAll(): Promise<Recording[]> {
		return this.recordingRepository.findAll();
	}

	async getByEventType(eventTypeId: number): Promise<Recording[]> {
		return this.recordingRepository.findByEventTypeId(eventTypeId);
	}
}
