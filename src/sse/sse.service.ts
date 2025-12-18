import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { SseEventMap, validateSseEventPayload } from './sse.events';

interface ActiveClient {
	userId: string;
	subscriber: Subscriber<MessageEvent>;
}

@Injectable()
export class SseService {
	private readonly logger = new Logger(SseService.name);

	private readonly clients = new Map<string, Set<Subscriber<MessageEvent>>>();

	subscribe(userId: string): Observable<MessageEvent> {
		return new Observable<MessageEvent>(subscriber => {
			this.addClient({ userId, subscriber });

			subscriber.next({
				type: 'connection_established',
				data: { message: 'SSE connection ready' },
			});

			return () => {
				this.removeClient({ userId, subscriber });
			};
		});
	}

	sendEvent<TEvent extends keyof SseEventMap>(userId: string, event: TEvent, data: SseEventMap[TEvent]): boolean {
		const subscribers = this.clients.get(userId);

		if (!subscribers || subscribers.size === 0) {
			this.logger.debug(`No active SSE subscribers for user ${userId}`);
			return false;
		}

		const payload = validateSseEventPayload(event, data);

		for (const subscriber of subscribers) {
			subscriber.next({
				type: event,
				data: payload,
			});
		}

		return true;
	}

	private addClient({ userId, subscriber }: ActiveClient) {
		const subscribers = this.clients.get(userId) ?? new Set<Subscriber<MessageEvent>>();
		subscribers.add(subscriber);
		this.clients.set(userId, subscribers);
		this.logger.verbose(`SSE client registered for user ${userId}, total clients: ${subscribers.size}`);
	}

	private removeClient({ userId, subscriber }: ActiveClient) {
		const subscribers = this.clients.get(userId);

		if (!subscribers) {
			return;
		}

		subscribers.delete(subscriber);

		if (subscribers.size === 0) {
			this.clients.delete(userId);
		}

		this.logger.verbose(`SSE client removed for user ${userId}, remaining clients: ${subscribers.size}`);
	}
}
