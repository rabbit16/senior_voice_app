import {encodeWavFromFloat32, mergeFloat32} from './wavEncode';
import type {RecordedAudio, VoiceRecorder} from './audioTypes';

type WebRecorderState = {
  stream: MediaStream;
  context: AudioContext;
  processor: ScriptProcessorNode;
  source: MediaStreamAudioSourceNode;
  mute: GainNode;
  chunks: Float32Array[];
  startedAt: number;
};

let state: WebRecorderState | null = null;
let micReady = false;

function micError(name: string, message: string): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

function assertMicEnvironment() {
  if (typeof window === 'undefined') {
    throw micError('UnsupportedError', '当前环境不支持麦克风录音');
  }
  // 浏览器规定：非安全上下文（明文 HTTP + 非 localhost）不能用麦克风。
  // 开发环境请用 npm run web 提供的 HTTPS 地址（如 https://10.6.64.31:5173）。
  if (window.isSecureContext === false) {
    throw micError(
      'InsecureContextError',
      '当前为 HTTP 明文地址，浏览器禁止麦克风。请改用 https:// 开头的地址打开（首次需点「继续访问」）',
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw micError(
      'UnsupportedError',
      '浏览器未提供麦克风接口，请改用最新 Chrome / Edge',
    );
  }
}

/**
 * 预申请麦克风权限（切到语音模式时调用）。
 * 避免「按住说话」过程中弹出权限框导致松手事件打断录音。
 */
export async function ensureMicPermission(): Promise<void> {
  assertMicEnvironment();

  try {
    const permissions = navigator.permissions;
    if (permissions?.query) {
      const status = await permissions.query({
        name: 'microphone' as PermissionName,
      });
      if (status.state === 'denied') {
        throw micError(
          'NotAllowedError',
          '麦克风权限已被拒绝，请在浏览器地址栏允许麦克风后重试',
        );
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      throw err;
    }
    // permissions.query 不支持 microphone 时忽略
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  stream.getTracks().forEach(track => track.stop());
  micReady = true;
}

async function start(): Promise<void> {
  if (state) {
    await cancel();
  }

  assertMicEnvironment();

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  micReady = true;

  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
  if (!AudioContextCtor) {
    stream.getTracks().forEach(track => track.stop());
    throw micError('UnsupportedError', '浏览器不支持 AudioContext，无法录音');
  }

  const context = new AudioContextCtor();
  try {
    if (context.state === 'suspended') {
      await context.resume();
    }

    if (typeof context.createScriptProcessor !== 'function') {
      throw micError('UnsupportedError', '浏览器不支持录音节点，请更换浏览器');
    }

    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];

    processor.onaudioprocess = event => {
      const input = event.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(input));
    };

    // 静音接到扬声器，避免回授；ScriptProcessor 需接到 destination 才会回调
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(context.destination);

    state = {
      stream,
      context,
      processor,
      source,
      mute,
      chunks,
      startedAt: Date.now(),
    };
  } catch (err) {
    stream.getTracks().forEach(track => track.stop());
    try {
      await context.close();
    } catch {
      // ignore
    }
    throw err;
  }
}

async function stop(): Promise<RecordedAudio> {
  if (!state) {
    throw micError('NotRecordingError', '尚未开始录音');
  }

  const current = state;
  state = null;

  const durationMs = Date.now() - current.startedAt;
  const sampleRate = current.context.sampleRate;
  current.processor.onaudioprocess = null;
  try {
    current.processor.disconnect();
    current.mute.disconnect();
    current.source.disconnect();
  } catch {
    // ignore
  }
  current.stream.getTracks().forEach(track => track.stop());
  await current.context.close();

  const samples = mergeFloat32(current.chunks);
  const blob = encodeWavFromFloat32(samples, sampleRate);

  return {
    format: 'wav',
    mimeType: 'audio/wav',
    name: `recording-${Date.now()}.wav`,
    blob,
    durationMs,
  };
}

async function cancel(): Promise<void> {
  if (!state) {
    return;
  }
  const current = state;
  state = null;
  current.processor.onaudioprocess = null;
  try {
    current.processor.disconnect();
    current.mute.disconnect();
    current.source.disconnect();
  } catch {
    // ignore
  }
  current.stream.getTracks().forEach(track => track.stop());
  try {
    await current.context.close();
  } catch {
    // ignore
  }
}

export function isMicPermissionWarm(): boolean {
  return micReady;
}

export const voiceRecorder: VoiceRecorder = {start, stop, cancel};
