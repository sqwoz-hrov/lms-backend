export interface InterviewWorkflowFailedWebhookPayload {
	videoId: string;
	transcriptionId: string;
	errorMessage: string;
	reason: 'failed';
}

export interface InterviewWorkflowCancelledWebhookPayload {
	videoId: string;
	transcriptionId: string;
	reason: 'cancelled';
}

export type InterviewWorkflowFailedCancelledWebhookPayload =
	| InterviewWorkflowFailedWebhookPayload
	| InterviewWorkflowCancelledWebhookPayload;
