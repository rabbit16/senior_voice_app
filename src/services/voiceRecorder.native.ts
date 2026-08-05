import {NativeModules, Platform} from 'react-native';
import type {RecordedAudio, VoiceRecorder} from './audioTypes';

type WavAudioRecorderNative = {
  start: (sampleRate: number) => Promise<void>;
  stop: () => Promise<string>;
  cancel: () => Promise<void>;
};

const native = NativeModules.WavAudioRecorder as WavAudioRecorderNative | undefined;

let startedAt = 0;

function requireNative(): WavAudioRecorderNative {
  if (!native?.start || !native?.stop || !native?.cancel) {
    throw Object.assign(new Error('原生录音模块未就绪，请重新编译 Android 应用'), {
      name: 'NativeModuleMissing',
    });
  }
  return native;
}

function toFileUri(path: string): string {
  if (path.startsWith('file://')) {
    return path;
  }
  return `file://${path}`;
}

/** Android 权限由 HomeScreen 用 PermissionsAndroid 申请；此处仅作兼容导出 */
export async function ensureMicPermission(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return;
  }
  // 原生侧真正录音时再校验；预热只需确认模块存在
  requireNative();
}

export function isMicPermissionWarm(): boolean {
  return Boolean(native?.start);
}

async function start(): Promise<void> {
  await requireNative().start(16000);
  startedAt = Date.now();
}

async function stop(): Promise<RecordedAudio> {
  const path = await requireNative().stop();
  const durationMs = startedAt ? Date.now() - startedAt : 0;
  startedAt = 0;
  return {
    format: 'wav',
    mimeType: 'audio/wav',
    name: `recording-${Date.now()}.wav`,
    uri: toFileUri(path),
    durationMs,
  };
}

async function cancel(): Promise<void> {
  startedAt = 0;
  await requireNative().cancel();
}

export const voiceRecorder: VoiceRecorder = {start, stop, cancel};
