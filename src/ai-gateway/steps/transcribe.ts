// doesn't know if it's interview or something else

import { emit } from "process";

// TODO: how to get notifications from sqwozWhisper?
// a. Long-running promise in the transcribe that resolves when transcription is done
// b. Notification emitter here with identifier
// c. Webhooks from sqwozWhisper to an endpoint in our service with common method here
export class TranscribeStep {
    private progressMemory: AsyncGenerator<any, void, unknown>;
    constructor(private readonly sqwozWhisperAdapter: unknown) {}


    async run({
        prompt,
        mediaUrl,
        maxSpeakers,
        minSpeakers = 2,
    }: {
        prompt: string;
        mediaUrl: string;
        maxSpeakers: number;
        minSpeakers?: number;
    }) {
        try {
            // check limits here
            await this.sqwozWhisperAdapter.sendTranscriptionJob({});
        } catch (error) {
            const reason = 'job_send_failed' as const;
            this.emit('error', {
                reason,
                error: (error as Error).message,
            });
        }
    }

    async handleResult({
        isOk,
        workflowId,
        res,
    }: {
        isOk: true;
        workflowId: string;
        res: {
            transcriptionId: string;
            s3TranscriptionKey: string;
            isMediaCached: boolean;
        }
    } | {
        isOk: false;
        workflowId: string;
        res: {
            error?: string;
            reason: string;
        }
    }) {
        // fuck this garbage
        if (isOk) {
            this.emit('complete', res); // see, this binds us to async handling of success and going to next step. But we would like to do it step by step. Handle, then run next step
            // or it makes us do everything in the callbacks in the workflow. Some better abstractions could help
        } else {
            this.emit('error', res);
        }


        // THIS! we'll need to implement progressMemory properly but yeah that's the big idea
        await this.progressMemory.next();
        
        // Or THIS. Maybe we should yield here and for-await-of in the workflow.run, idk
        this.workflow.next(res);
    }
}