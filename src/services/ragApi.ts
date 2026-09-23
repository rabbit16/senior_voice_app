import {Platform} from 'react-native';
import {env, getRagRoot} from '../config/env';
import {ApiError} from './http';
import {
  MedicalRecommendation,
  RecommendDoctor,
  RecommendRiskLevel,
  RecommendWebHit,
  parseRecommendRiskLevel,
} from './qaApi';

const TRIAGE_COLLECTION = 'triage';
const RAG_TIMEOUT_MS = 90000;
const MAX_DOCTORS = 3;
const MAX_WEB_HITS = 3;

export type RagHit = {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export type RagWebHit = {
  title: string;
  url: string;
  snippet?: string;
};

export type RagQueryResult = {
  collection: string;
  query: string;
  answer: string;
  hits: RagHit[];
  doctor_hits: RagHit[];
  web_hits: RagWebHit[];
  reranked?: boolean;
  city?: string;
};

export type RagQueryHandlers = {
  onMeta?: (meta: Omit<RagQueryResult, 'answer'>) => void;
  onDelta?: (text: string) => void;
  onDone?: (result: RagQueryResult) => void;
};

type SseEvent = {
  type?: string;
  text?: string;
  answer?: string;
  code?: string;
  message?: string;
  collection?: string;
  query?: string;
  city?: string;
  reranked?: boolean;
  hits?: RagHit[];
  doctor_hits?: RagHit[];
  web_hits?: RagWebHit[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstLine(text: string): string {
  return text
    .split(/\n+/)
    .map(line => line.replace(/^[#*\s【】[\]-]+/g, '').trim())
    .find(Boolean) || text.trim();
}

function excerpt(text: string, maxChars = 80): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxChars) {
    return compact;
  }
  return `${compact.slice(0, maxChars).trim()}…`;
}

function parseHits(raw: unknown): RagHit[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item, index) => {
      const row = asRecord(item);
      const id = asString(row.id) || `hit-${index}`;
      const text = asString(row.text);
      const score = typeof row.score === 'number' ? row.score : 0;
      return {
        id,
        text,
        score,
        metadata: asRecord(row.metadata),
      };
    })
    .filter(hit => hit.text || Object.keys(hit.metadata || {}).length);
}

function parseWebHits(raw: unknown): RagWebHit[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(item => {
      const row = asRecord(item);
      return {
        title: asString(row.title),
        url: asString(row.url),
        snippet: asString(row.snippet) || undefined,
      };
    })
    .filter(hit => hit.title && hit.url);
}

function emptyRagResult(query: string): RagQueryResult {
  return {
    collection: TRIAGE_COLLECTION,
    query,
    answer: '',
    hits: [],
    doctor_hits: [],
    web_hits: [],
    city: env.ragCity,
  };
}

function fromSseMeta(event: SseEvent, query: string): Omit<RagQueryResult, 'answer'> {
  return {
    collection: asString(event.collection) || TRIAGE_COLLECTION,
    query: asString(event.query) || query,
    hits: parseHits(event.hits),
    doctor_hits: parseHits(event.doctor_hits),
    web_hits: parseWebHits(event.web_hits),
    reranked: Boolean(event.reranked),
    city: asString(event.city) || env.ragCity,
  };
}

function ragErrorBody(data: unknown, fallbackStatus: number): {code: string; message: string} {
  const root = asRecord(data);
  const nested = asRecord(root.error);
  const code = asString(nested.code) || asString(root.code) || 'rag_error';
  const message =
    asString(nested.message) ||
    asString(root.message) ||
    (typeof root.detail === 'string' ? root.detail : '');
  if (code === 'configuration_error') {
    return {code, message: message || '就医推荐服务未就绪'};
  }
  if (fallbackStatus === 404 || /not found/i.test(message) || code === 'not_found') {
    return {
      code: 'not_found',
      message: '就医推荐接口 404。请求没有打到 RAG 服务，请确认 ragBaseUrl 已写入最新安装包，且 Web 已重启 npm run web',
    };
  }
  return {code, message: message || `HTTP ${fallbackStatus}`};
}

function unwrapQueryData(data: unknown, query: string): RagQueryResult {
  const root = asRecord(data);
  if (root.ok === false) {
    const err = ragErrorBody(data, 500);
    throw new ApiError(500, err);
  }
  const payload = root.data && typeof root.data === 'object' ? asRecord(root.data) : root;
  return {
    collection: asString(payload.collection) || TRIAGE_COLLECTION,
    query: asString(payload.query) || query,
    answer: asString(payload.answer),
    hits: parseHits(payload.hits),
    doctor_hits: parseHits(payload.doctor_hits),
    web_hits: parseWebHits(payload.web_hits),
    reranked: Boolean(payload.reranked),
    city: asString(payload.city) || env.ragCity,
  };
}

function parseSseChunk(buffer: string): {events: SseEvent[]; rest: string} {
  // SSE frames are allowed to use either LF or CRLF line endings.
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? '';
  const events: SseEvent[] = [];
  for (const part of parts) {
    const dataLines = part
      .split(/\r?\n/)
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

function isEmergencyHit(hit: RagHit): boolean {
  const meta = hit.metadata || {};
  const department = asString(meta.department) || asString(meta.dept);
  const docType = asString(meta.doc_type) || asString(meta.type);
  const blob = `${department} ${docType} ${hit.text}`;
  return /急诊|120|emergency/i.test(blob);
}

function uniqueDepartments(hits: RagHit[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const hit of hits) {
    const department = asString(hit.metadata?.department) || asString(hit.metadata?.dept);
    if (!department || seen.has(department)) {
      continue;
    }
    seen.add(department);
    result.push(department);
    if (result.length >= 2) {
      break;
    }
  }
  return result;
}

function inferRisk(result: RagQueryResult | null | undefined): RecommendRiskLevel {
  if (!result) {
    return 'low';
  }
  const blob = [
    result.answer,
    ...result.hits.map(hit => `${hit.text} ${asString(hit.metadata?.department)}`),
    ...result.doctor_hits.map(hit => hit.text),
  ].join(' ');
  if (/急诊|120|立刻|立即|危险征象/.test(blob)) {
    return 'high';
  }
  if (/尽快|尽快就诊|专科门诊/.test(blob)) {
    return 'medium';
  }
  return 'low';
}

function inferCareHint(risk: RecommendRiskLevel, department: string): string {
  if (risk === 'high') {
    return '请立即拨打 120 或去急诊';
  }
  if (department.includes('全科') || !department) {
    return '建议先去社区医院门诊';
  }
  return `建议去${department}门诊`;
}

export function formatDoctorHit(hit: RagHit): RecommendDoctor {
  const meta = hit.metadata || {};
  const name = asString(meta.name) || asString(meta.doctor) || asString(meta.doctor_name);
  const hospital =
    asString(meta.hospital) || asString(meta.hospital_name) || asString(meta.org) || asString(meta.clinic);
  const department = asString(meta.department) || asString(meta.dept);
  const jobTitle = asString(meta.title) || asString(meta.position);
  const url = asString(meta.url) || asString(meta.link);
  const title =
    name && hospital ? `${hospital} · ${name}` : name || hospital || firstLine(hit.text) || '医院或医生建议';
  const detailParts = [department, jobTitle, excerpt(hit.text)].filter(Boolean);
  return {
    id: hit.id,
    title,
    detail: Array.from(new Set(detailParts)).join('\n'),
    department: department || undefined,
    url: url || undefined,
    emergency: isEmergencyHit(hit),
  };
}

function toWebHits(hits: RagWebHit[]): RecommendWebHit[] {
  return hits.slice(0, MAX_WEB_HITS).map(hit => ({
    title: hit.title,
    url: hit.url,
    snippet: hit.snippet ? excerpt(hit.snippet, 90) : undefined,
  }));
}

export type DialogueTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export function buildTriageQuery(input: {
  turns?: DialogueTurn[];
  questions?: string[];
  diagnosis?: string;
}): string {
  const turns = (input.turns || [])
    .map(turn => ({
      role: turn.role,
      content: turn.content.trim(),
    }))
    .filter(turn => turn.content);

  const lines = turns.map(turn => `${turn.role === 'user' ? '患者' : '助手'}：${turn.content}`);
  const diagnosis = (input.diagnosis || '').trim();
  const parts: string[] = [];

  if (lines.length) {
    parts.push('以下是完整问诊对话：');
    parts.push(lines.join('\n'));
  } else {
    const symptoms = (input.questions || []).map(item => item.trim()).filter(Boolean);
    if (symptoms.length) {
      parts.push(`患者症状：${symptoms.join('；')}`);
    }
    if (diagnosis) {
      parts.push(`初步判断：${diagnosis}`);
    }
  }

  if (!parts.length) {
    return '';
  }
  parts.push('请根据以上完整对话，推荐就诊科室，以及上海可看的医院或医生。不要给出确诊病名。');
  return parts.join('\n');
}

export function hasRecommendContent(rec: MedicalRecommendation | null | undefined): boolean {
  if (!rec) {
    return false;
  }
  return Boolean(
    rec.department || rec.care_hint || rec.body || rec.doctors?.length || rec.web_hits?.length,
  );
}

/**
 * 把主后端结构化卡片和 RAG 召回合成一页给老人看的推荐。
 * 科室 / 去哪看 / 风险优先用后端；医生列表和联网资料来自 RAG。
 */
export function mergeMedicalRecommendation(
  sessionId: string,
  backend: MedicalRecommendation | null | undefined,
  rag: RagQueryResult | null | undefined,
): MedicalRecommendation | null {
  if (!backend && !rag) {
    return null;
  }
  const doctors = (rag?.doctor_hits || [])
    .map(formatDoctorHit)
    .sort((a, b) => Number(b.emergency) - Number(a.emergency))
    .slice(0, MAX_DOCTORS);
  const ragEmergency = doctors.some(item => item.emergency) || inferRisk(rag) === 'high';
  const department = (backend?.department || uniqueDepartments(rag?.hits || []).join('或')).trim();
  const risk: RecommendRiskLevel = ragEmergency
    ? 'high'
    : parseRecommendRiskLevel(backend?.risk_level || inferRisk(rag));
  const backendHint = (backend?.care_hint || '').trim();
  const careHint =
    risk === 'high' && !/急诊|120/.test(backendHint)
      ? inferCareHint('high', department)
      : backendHint || inferCareHint(risk, department);
  const body = (backend?.body || rag?.answer || '').trim();
  const merged: MedicalRecommendation = {
    id: backend?.id,
    session_id: backend?.session_id || sessionId,
    title: (backend?.title || '').trim(),
    department,
    care_hint: careHint,
    body,
    risk_level: risk,
    disclaimer: (backend?.disclaimer || '').trim(),
    created_at: backend?.created_at,
    updated_at: backend?.updated_at,
    city: rag?.city || env.ragCity,
    doctors,
    web_hits: toWebHits(rag?.web_hits || []),
  };
  return hasRecommendContent(merged) ? merged : null;
}

function ragHeaders(accept: string, stream: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    'Content-Type': 'application/json',
  };
  if (stream) {
    // 避免 gzip 把 SSE 攒成一整包，前端才能边收边画
    headers['Accept-Encoding'] = 'identity';
    headers['Cache-Control'] = 'no-cache';
  }
  if (env.ragApiKey) {
    headers['X-API-Key'] = env.ragApiKey;
  }
  return headers;
}

/** HTTPS 页面走 Vite `/rag` 代理到 RAG 端口，避免和主后端 `/api` 混在一起。 */
function queriesUrl(): string {
  const path = '/api/v1/queries';
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/rag${path}`;
  }
  return `${getRagRoot()}${path}`;
}

async function withRagTimeout<T>(
  signal: AbortSignal | undefined,
  run: (merged: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);
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
      message: '网络异常，请确认就医推荐服务已启动',
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function consumeRagSse(
  response: Response,
  query: string,
  handlers: RagQueryHandlers,
): Promise<RagQueryResult> {
  let result: RagQueryResult = emptyRagResult(query);
  let streamError: {code: string; message: string} | null = null;
  let completed = false;

  const consume = (event: SseEvent) => {
    if (event.type === 'meta') {
      const meta = fromSseMeta(event, query);
      result = {...result, ...meta};
      handlers.onMeta?.(meta);
      return;
    }
    if (event.type === 'delta' && event.text) {
      result = {...result, answer: `${result.answer}${event.text}`};
      handlers.onDelta?.(event.text);
      return;
    }
    if (event.type === 'done') {
      result = {...result, answer: asString(event.answer) || result.answer};
      completed = true;
      handlers.onDone?.(result);
      return;
    }
    if (event.type === 'error') {
      streamError = {
        code: asString(event.code) || 'rag_error',
        message: asString(event.message) || '就医建议获取失败，请稍后重试',
      };
    }
  };

  const reader = response.body?.getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const {done, value} = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, {stream: true});
      const parsed = parseSseChunk(buffer);
      buffer = parsed.rest;
      parsed.events.forEach(consume);
      if (streamError || completed) {
        break;
      }
    }
    if (buffer.trim()) {
      parseSseChunk(`${buffer}\n\n`).events.forEach(consume);
    }
  } else {
    const text = await response.text();
    parseSseChunk(`${text}\n\n`).events.forEach(consume);
  }

  if (streamError) {
    throw new ApiError(500, streamError);
  }
  if (!completed && !result.answer && !result.hits.length && !result.doctor_hits.length) {
    throw new ApiError(500, {code: 'rag_incomplete', message: '未收到完整就医建议，请重试'});
  }
  return result;
}

/**
 * 问诊 RAG：POST /api/v1/queries，collection=triage。
 * 就医推荐默认 SSE 流式（stream=true）；服务端若回 JSON 仍可解析。
 */
export async function requestTriageRecommendation(
  input: {query: string; city?: string; webSearch?: boolean; stream?: boolean},
  handlers: RagQueryHandlers = {},
  signal?: AbortSignal,
): Promise<RagQueryResult> {
  const query = input.query.trim();
  if (!query) {
    throw new ApiError(400, {code: 'validation_error', message: '请先完成问询，再查看就医推荐'});
  }
  const stream = input.stream !== false;

  return withRagTimeout(signal, async mergedSignal => {
    const response = await fetch(queriesUrl(), {
      method: 'POST',
      headers: ragHeaders(stream ? 'text/event-stream' : 'application/json', stream),
      body: JSON.stringify({
        collection: TRIAGE_COLLECTION,
        query,
        top_k: 5,
        stream,
        web_search: input.webSearch ?? true,
        city: input.city || env.ragCity,
      }),
      signal: mergedSignal,
    });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok) {
      const text = await response.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      const err = ragErrorBody(data, response.status);
      throw new ApiError(response.status, err);
    }

    if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
      const data = (await response.json()) as unknown;
      const result = unwrapQueryData(data, query);
      handlers.onMeta?.({
        collection: result.collection,
        query: result.query,
        hits: result.hits,
        doctor_hits: result.doctor_hits,
        web_hits: result.web_hits,
        reranked: result.reranked,
        city: result.city,
      });
      if (result.answer) {
        handlers.onDelta?.(result.answer);
      }
      handlers.onDone?.(result);
      return result;
    }

    return consumeRagSse(response, query, handlers);
  });
}
