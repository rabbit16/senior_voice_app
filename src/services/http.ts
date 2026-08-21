import {env, getApiRoot} from '../config/env';

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code || 'unknown_error';
    this.details = body.details;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  token?: string | null;
  formData?: FormData;
  signal?: AbortSignal;
  /** 不传则用 config/api.json 的 timeoutMs */
  timeoutMs?: number;
};

function normalizeErrorBody(
  status: number,
  data: unknown,
  statusText: string,
): ApiErrorBody {
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>;
    if (typeof body.message === 'string' && body.message) {
      return {
        code: typeof body.code === 'string' ? body.code : 'http_error',
        message: body.message,
        details: (body.details as Record<string, unknown> | undefined) ?? undefined,
      };
    }
    // FastAPI 校验错误：{ detail: [{ msg, loc, ... }] }
    if (Array.isArray(body.detail)) {
      const first = body.detail[0] as {msg?: string} | undefined;
      return {
        code: 'validation_error',
        message: first?.msg || '请求参数不正确',
        details: {detail: body.detail},
      };
    }
    if (typeof body.detail === 'string' && body.detail) {
      return {code: 'http_error', message: body.detail};
    }
  }
  return {
    code: 'http_error',
    message: statusText || `HTTP ${status}`,
  };
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = `${getApiRoot()}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) {
    return base;
  }
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * 统一 HTTP 客户端。后续所有 service 都应通过此函数发请求。
 */
export async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const {method = 'GET', path, query, body, token, formData, signal} = options;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? env.timeoutMs;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (!formData && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: formData ? formData : body !== undefined ? JSON.stringify(body) : undefined,
      signal: signal ?? controller.signal,
    });

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        throw new ApiError(response.status || 0, {
          code: 'invalid_json',
          message: `后端返回了非 JSON 内容（HTTP ${response.status}）`,
        });
      }
    }

    if (!response.ok) {
      throw new ApiError(response.status, normalizeErrorBody(response.status, data, response.statusText));
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(408, {code: 'timeout', message: '请求超时，请稍后重试'});
    }
    throw new ApiError(0, {
      code: 'network_error',
      message: '网络异常，请确认后端已启动，且地址为 127.0.0.1（Web）或正确 IP',
    });
  } finally {
    clearTimeout(timeout);
  }
}
