export type AudioFormat = 'wav' | 'mp3';

/** 录音结果：Web 用 Blob，Android 用本地 uri */
export type RecordedAudio = {
  format: AudioFormat;
  mimeType: string;
  name: string;
  /** Web */
  blob?: Blob;
  /** React Native：file:// 或绝对路径 */
  uri?: string;
  durationMs: number;
};

export type VoiceRecorder = {
  start: () => Promise<void>;
  stop: () => Promise<RecordedAudio>;
  cancel: () => Promise<void>;
};
