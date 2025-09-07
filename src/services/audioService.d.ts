export class AudioService {
  constructor();
  startRecording(): Promise<void>;
  stopRecording(): Promise<Blob>;
  cancelRecording(): void;
  transcribeAudio(audioBlob: Blob): Promise<string>;
  cleanup(): void;
}

declare const audioService: AudioService;
export default audioService;