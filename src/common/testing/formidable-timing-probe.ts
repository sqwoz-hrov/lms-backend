import { Injectable } from '@nestjs/common';

export type FormidableTimingMark = {
	requestStartAt?: number; // момент входа запроса в интерсептор
	startAt?: number; // начало parse()
	endAt?: number; // конец parse()
	elapsedMs?: number;
};

@Injectable()
export class FormidableTimingProbe {
	public mark: FormidableTimingMark = {};

	reset() {
		this.mark = {};
	}

	onRequestStart = () => {
		this.mark.requestStartAt = Date.now();
	};

	onParseStart = () => {
		this.mark.startAt = Date.now();
	};

	onParseEnd = () => {
		this.mark.endAt = Date.now();
		if (this.mark.startAt !== undefined) {
			this.mark.elapsedMs = this.mark.endAt - this.mark.startAt;
		}
	};
}
