import {env, getApiRoot} from '../config/env';
import {ApiError, apiRequest} from './http';

export type QaLang = 'zh' | 'en';

/** 症状追问阶段：以 done.phase 为准 */
export type QaPhase = 'followup' | 'diagnosis' | 'emergency';

export type QaAskMeta = {
  context_id: string;
  lang: QaLang;
  question_text: string;
  context_continued: boolean;
  turn_index_user: number;
  turn_index_assistant: number;
  intake_round?: number;
  input_mode?: string;
};

export type QaAskDone = {
  context_id: string;
  lang: QaLang;
  question_text: string;
  answer_text: string;
  turn_index_user: number;
  turn_index_assistant: number;
  context_continued: boolean;
  created_at: string;
  phase?: QaPhase;
  intake_complete?: boolean;
  intake_round?: number;
};

export type QaAskHandlers = {
  onMeta?: (meta: QaAskMeta) => void;
  onPhase?: (phase: QaPhase) => void;
  onToken?: (delta: string) => void;
  onDone?: (done: QaAskDone) => void;
  onError?: (error: {code: string; message: string}) => void;
};

/** 兼容旧调用方的问答结果形状 */
export type QaAnswer = {
  session_id: string;
  question_text: string;
  answer_text: string;
  lang: QaLang;
  created_at: string;
};

export type MedicalRecommendation = {
  session_id: string;
  title: string;
  body: string;
  risk_level: 'low' | 'medium' | 'high';
  disclaimer: string;
};

type SseEvent = {
  type?: string;
  delta?: string;
  code?: string;
  message?: string;
  context_id?: string;
  lang?: QaLang;
  question_text?: string;
  answer_text?: string;
  turn_index_user?: number;
  turn_index_assistant?: number;
  context_continued?: boolean;
  created_at?: string;
  phase?: string;
  intake_complete?: boolean;
  intake_round?: number;
  input_mode?: string;
};

const PHASE_TOKEN_RE = /^(?:[【[]\s*)?(FOLLOWUP|DIAGNOSIS|EMERGENCY|INTAKE)(?:\s*[】\]])?\s*[:：]?$/i;

/** 去掉模型可能泄漏的阶段标记，只留给用户看的口语 */
export function sanitizeQaSpokenText(raw: string): string {
  if (!raw) {
    return '';
  }
  return raw
    .replace(/[【[]\s*(FOLLOWUP|DIAGNOSIS|EMERGENCY|INTAKE|追问|初步判断|急救)\s*[】\]]/gi, ' ')
    .replace(/\b(FOLLOWUP|DIAGNOSIS|EMERGENCY|INTAKE)\b\s*[:：]?\s*/gi, ' ')
    .replace(/^[ \t]*[:：\-—]+\s*/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseQaPhase(value: unknown): QaPhase | undefined {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === 'followup' || raw === 'diagnosis' || raw === 'emergency') {
    return raw;
  }
  return undefined;
}

function isPhaseMarkerDelta(delta: string): boolean {
  return PHASE_TOKEN_RE.test(delta.trim());
}

function toQaAskDone(event: SseEvent): QaAskDone | null {
  if (!event.context_id || event.question_text == null || event.answer_text == null) {
    return null;
  }
  return {
    context_id: event.context_id,
    lang: event.lang || 'zh',
    question_text: event.question_text,
    answer_text: sanitizeQaSpokenText(event.answer_text),
    turn_index_user: event.turn_index_user ?? 0,
    turn_index_assistant: event.turn_index_assistant ?? 0,
    context_continued: Boolean(event.context_continued),
    created_at: event.created_at || new Date().toISOString(),
    phase: parseQaPhase(event.phase),
    intake_complete: Boolean(event.intake_complete),
    intake_round: event.intake_round,
  };
}

function parseSseChunk(buffer: string): {events: SseEvent[]; rest: string} {
  const parts = buffer.split(/\n\n/);
  const rest = parts.pop() ?? '';
  const events: SseEvent[] = [];

  for (const part of parts) {
    const dataLines = part
      .split(/\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart());
    if (!dataLines.length) {
      continue;
    }
    const raw = dataLines.join('\n');
    if (!raw || raw === '[DONE]') {
      continue;
    }
    try {
      events.push(JSON.parse(raw) as SseEvent);
    } catch {
      // 忽略半截/非 JSON 行
    }
  }

  return {events, rest};
}

function dispatchSseEvent(event: SseEvent, handlers: QaAskHandlers): boolean {
  switch (event.type) {
    case 'meta':
      if (event.context_id && event.question_text) {
        handlers.onMeta?.({
          context_id: event.context_id,
          lang: event.lang || 'zh',
          question_text: event.question_text,
          context_continued: Boolean(event.context_continued),
          turn_index_user: event.turn_index_user ?? 0,
          turn_index_assistant: event.turn_index_assistant ?? 0,
          intake_round: event.intake_round,
          input_mode: event.input_mode,
        });
      }
      return false;
    case 'phase': {
      const phase = parseQaPhase(event.phase);
      if (phase) {
        handlers.onPhase?.(phase);
      }
      return false;
    }
    case 'token':
      if (event.delta && !isPhaseMarkerDelta(event.delta)) {
        handlers.onToken?.(event.delta);
      }
      return false;
    case 'done': {
      const done = toQaAskDone(event);
      if (done) {
        handlers.onDone?.(done);
      }
      return true;
    }
    case 'error':
      handlers.onError?.({
        code: event.code || 'qa_stream_failed',
        message: event.message || '生成回答失败',
      });
      return true;
    default:
      return false;
  }
}

async function consumeQaSseResponse(
  response: Response,
  handlers: QaAskHandlers,
): Promise<QaAskDone> {
  if (!response.ok) {
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    const body = (data || {}) as {code?: string; message?: string; detail?: unknown};
    throw new ApiError(response.status, {
      code: body.code || 'http_error',
      message:
        body.message ||
        (typeof body.detail === 'string' ? body.detail : '') ||
        response.statusText ||
        `HTTP ${response.status}`,
    });
  }

  let done: QaAskDone | null = null;
  let streamError: {code: string; message: string} | null = null;

  const consumeEvent = (event: SseEvent) => {
    if (event.type === 'done') {
      const parsed = toQaAskDone(event);
      if (parsed) {
        done = parsed;
      }
    }
    if (event.type === 'error') {
      streamError = {
        code: event.code || 'qa_stream_failed',
        message: event.message || '生成回答失败',
      };
    }
    dispatchSseEvent(event, handlers);
  };

  const reader = response.body?.getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const {done: ended, value} = await reader.read();
      if (ended) {
        break;
      }
      buffer += decoder.decode(value, {stream: true});
      const parsed = parseSseChunk(buffer);
      buffer = parsed.rest;
      parsed.events.forEach(consumeEvent);
      if (streamError || done) {
        break;
      }
    }
    if (buffer.trim()) {
      const parsed = parseSseChunk(`${buffer}\n\n`);
      parsed.events.forEach(consumeEvent);
    }
  } else {
    const text = await response.text();
    const parsed = parseSseChunk(`${text}\n\n`);
    parsed.events.forEach(consumeEvent);
  }

  if (streamError) {
    throw new ApiError(500, streamError);
  }
  if (!done) {
    throw new ApiError(500, {
      code: 'qa_incomplete',
      message: '未收到完整回答，请重试',
    });
  }
  return done;
}

async function withQaFetchTimeout<T>(
  signal: AbortSignal | undefined,
  timeoutMs: number,
  run: (mergedSignal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    return await run(controller.signal);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(408, {code: 'timeout', message: '请求超时，请稍后重试'});
    }
    throw new ApiError(0, {
      code: 'network_error',
      message: '网络异常，请确认后端已启动',
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * 适老化文字问答：POST /qa/ask（SSE）。
 * 默认不传 new_context，由服务端沿用当前上下文；仅用户点「新问题」时传 true。
 * Web / 支持流式的环境会边收边回调；否则解析完整响应。
 */
export async function askTextStream(
  token: string,
  input: {question: string; lang?: QaLang; new_context?: boolean},
  handlers: QaAskHandlers = {},
  signal?: AbortSignal,
): Promise<QaAskDone> {
  return withQaFetchTimeout(signal, env.timeoutMs, async mergedSignal => {
    const response = await fetch(`${getApiRoot()}/qa/ask`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        question: input.question,
        lang: input.lang || 'zh',
        ...(input.new_context ? {new_context: true} : {}),
      }),
      signal: mergedSignal,
    });
    return consumeQaSseResponse(response, handlers);
  });
}

export type AskAudioInput = {
  /** Web: Blob；RN: {uri,type,name} */
  file: Blob | {uri: string; type: string; name: string};
  fileName?: string;
  lang?: QaLang;
  new_context?: boolean;
  audio_format?: 'wav' | 'mp3';
  prompt?: string;
};

/**
 * 语音输入问答：POST /qa/ask/audio（multipart + SSE，事件同 /qa/ask）。
 */
export async function askAudioStream(
  token: string,
  input: AskAudioInput,
  handlers: QaAskHandlers = {},
  signal?: AbortSignal,
): Promise<QaAskDone> {
  // 音频模型通常比纯文字慢
  const timeoutMs = Math.max(env.timeoutMs, 90000);

  return withQaFetchTimeout(signal, timeoutMs, async mergedSignal => {
    const formData = new FormData();
    const fileName = input.fileName || 'recording.wav';
    if (typeof Blob !== 'undefined' && input.file instanceof Blob) {
      formData.append('file', input.file, fileName);
    } else {
      formData.append('file', input.file as unknown as Blob);
    }
    formData.append('lang', input.lang || 'zh');
    if (input.new_context) {
      formData.append('new_context', 'true');
    }
    if (input.audio_format) {
      formData.append('audio_format', input.audio_format);
    }
    if (input.prompt) {
      formData.append('prompt', input.prompt);
    }

    const response = await fetch(`${getApiRoot()}/qa/ask/audio`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      signal: mergedSignal,
    });
    return consumeQaSseResponse(response, handlers);
  });
}

/** 等完整回答（内部仍走 SSE） */
export async function askQuestion(
  token: string,
  input: {question: string; lang?: QaLang; new_context?: boolean},
): Promise<QaAnswer> {
  const done = await askTextStream(token, input);
  return {
    session_id: done.context_id,
    question_text: done.question_text,
    answer_text: done.answer_text,
    lang: done.lang,
    created_at: done.created_at,
  };
}

export async function clearQaContext(
  token: string,
): Promise<{ok: true; context_id: string | null}> {
  return apiRequest({
    method: 'POST',
    path: '/qa/context/clear',
    token,
  });
}

/**
 * 上传音频进行语音识别。
 * FormData 字段约定：file（音频）、lang（zh|en）
 */
export async function recognizeSpeech(
  token: string,
  input: {file: {uri: string; type: string; name: string}; lang: QaLang},
): Promise<{text: string; duration_ms?: number}> {
  const formData = new FormData();
  formData.append('file', input.file as unknown as Blob);
  formData.append('lang', input.lang);

  return apiRequest({
    method: 'POST',
    path: '/voice/recognize',
    token,
    formData,
  });
}

export async function getQaSession(token: string, sessionId: string): Promise<QaAnswer> {
  return apiRequest({
    method: 'GET',
    path: `/qa/sessions/${sessionId}`,
    token,
  });
}

export async function requestMedicalRecommendation(
  token: string,
  sessionId: string,
): Promise<MedicalRecommendation> {
  return apiRequest({
    method: 'POST',
    path: `/qa/sessions/${sessionId}/recommendations`,
    token,
  });
}
