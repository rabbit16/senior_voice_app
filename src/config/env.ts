import apiConfig from '../../config/api.json';

type ApiJson = {
  apiBaseUrl: string;
  apiPrefix?: string;
  timeoutMs?: number;
  /** 完整 RAG 根地址。填了则忽略 ragPort */
  ragBaseUrl?: string;
  /** 与 apiBaseUrl 同一主机、只换端口。例如 8001。对 natapp 这类无端口域名无效 */
  ragPort?: number | string;
  ragApiKey?: string;
  ragCity?: string;
};

const config = apiConfig as ApiJson;

function trimSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function withPort(baseUrl: string, port: number | string): string {
  const parsed = new URL(trimSlash(baseUrl));
  parsed.port = String(port);
  return trimSlash(parsed.origin);
}

/** 只有本机/局域网 IP（或已经带端口）才能用 ragPort 换端口；natapp 域名不能加 :8001 */
function canSwapPort(baseUrl: string): boolean {
  try {
    const parsed = new URL(trimSlash(baseUrl));
    if (parsed.port) {
      return true;
    }
    const host = parsed.hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    );
  } catch {
    return false;
  }
}

function resolveRagBaseUrl(cfg: ApiJson): string {
  const explicit = (cfg.ragBaseUrl || '').trim();
  if (explicit) {
    return trimSlash(explicit);
  }
  const port = cfg.ragPort;
  if (port !== undefined && port !== null && String(port).trim() !== '' && canSwapPort(cfg.apiBaseUrl)) {
    return withPort(cfg.apiBaseUrl, port);
  }
  return trimSlash(cfg.apiBaseUrl);
}

/**
 * 仅浏览器 HTTPS 页面走同源代理。
 * 手机 APK 没有 Vite，必须直连 api.json 里的地址（内网穿透 / 公网）。
 */
export function toWebProxyUrl(url: string): string {
  const isBrowser =
    typeof document !== 'undefined' && typeof window !== 'undefined' && Boolean(window.location);
  if (!isBrowser || window.location.protocol !== 'https:') {
    return url;
  }
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol !== 'http:') {
      return url;
    }
    return `${window.location.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/**
 * 应用运行时配置。
 * 改后端地址：编辑项目根目录 `config/api.json` 的 `apiBaseUrl`，然后重新打包。
 * 也可在打包时用环境变量覆盖：`API_BASE_URL=http://x.x.x.x:8000 npm run build:android`
 *
 * 就医推荐还会打 RAG：`POST {ragBaseUrl}/api/v1/queries`，collection 固定 `triage`。
 * 同一主机不同端口：只填 `ragPort`（例如 8001）。
 * natapp / 公网域名：不要靠 ragPort；RAG 另开隧道或填本地 `ragBaseUrl`。
 */
export const env = {
  apiBaseUrl: trimSlash(config.apiBaseUrl),
  apiPrefix: config.apiPrefix || '/api/v1',
  timeoutMs: config.timeoutMs ?? 30000,
  ragBaseUrl: resolveRagBaseUrl(config),
  ragApiKey: (config.ragApiKey || '').trim(),
  ragCity: (config.ragCity || '上海').trim() || '上海',
} as const;

/** 完整 API 根路径。HTTPS 网页下为当前站点 /api/v1，避免混合内容 */
export function getApiRoot(): string {
  return toWebProxyUrl(`${env.apiBaseUrl}${env.apiPrefix}`);
}

/** RAG 服务根地址（不含 /api/v1） */
export function getRagRoot(): string {
  return env.ragBaseUrl;
}
