export function buildTranscriptionAudioStorageKey(videoId: string): string {
	return `transcription-audio/video/${videoId}/source.wav`;
}
