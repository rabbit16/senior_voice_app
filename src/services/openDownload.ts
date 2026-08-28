import {Linking, Platform} from 'react-native';
import {env} from '../config/env';
import {getAccessToken} from './session';

const PDF_TIMEOUT_MS = 60000;

/** 相对路径补成后端绝对地址 */
export function resolveDownloadUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `http:${trimmed}`;
  }
  if (trimmed.startsWith('/')) {
    return `${env.apiBaseUrl}${trimmed}`;
  }
  return `${env.apiBaseUrl}/${trimmed}`;
}

/**
 * Web 在 HTTPS 下不能跳转到后端的 http:// 链接（会停在 about:blank）。
 * 把同机 API 地址改成当前站点路径，走 Vite `/api` 代理。
 */
export function toWebFetchUrl(url: string): string {
  const resolved = resolveDownloadUrl(url);
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return resolved;
  }
  try {
    const parsed = new URL(resolved, window.location.origin);
    if (parsed.pathname.startsWith('/api/')) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // keep resolved
  }
  return resolved;
}

export function safePdfFilename(name?: string | null): string {
  const cleaned = (name || '健康档案.pdf')
    .replace(/[\\/:*?"<>|：]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const base = cleaned || '健康档案.pdf';
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') {
    throw new Error('blob_download_unavailable');
  }
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

async function fetchPdfBlob(url: string, token?: string | null): Promise<Blob> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PDF_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      Accept: 'application/pdf,application/octet-stream,*/*',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(url, {method: 'GET', headers, signal: controller.signal});
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const data = (await response.json()) as {message?: string};
      throw new Error(data.message || 'export_not_pdf');
    }
    if (!response.ok) {
      throw new Error(`export_http_${response.status}`);
    }
    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      throw new Error('empty_pdf');
    }
    if (blob.type && blob.type.toLowerCase().includes('json')) {
      throw new Error('export_not_pdf');
    }
    return blob.type ? blob : new Blob([blob], {type: 'application/pdf'});
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 按 export 返回的 download_url 把 PDF 存到本地。
 * Web：同源代理拉取后用 a[download]；APK：系统浏览器打开附件链接。
 */
export async function openDownloadUrl(url: string, filename?: string): Promise<void> {
  const resolved = resolveDownloadUrl(url);
  if (!resolved) {
    throw new Error('empty_download_url');
  }
  const name = safePdfFilename(filename);
  const token = getAccessToken();

  if (Platform.OS === 'web') {
    const fetchUrl = toWebFetchUrl(resolved);
    const blob = await fetchPdfBlob(fetchUrl, token);
    triggerBlobDownload(blob, name);
    return;
  }

  await Linking.openURL(resolved);
}

/** @deprecated 空白标签方案已弃用，保留以免旧调用报错 */
export function prepareDownloadWindow(): null {
  return null;
}
