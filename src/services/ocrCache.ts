import {storageGet, storageRemove, storageSet} from './storage';

export type CachedOcrDraft = {
  diagnosis: string;
  medicine: string;
  visit_date: string;
  visit_no: string;
  raw_ocr_text: string;
  document_type?: 'visit' | 'exam';
  patient_name?: string | null;
  org_name?: string | null;
  voucher_no?: string | null;
  report_type?: string | null;
};

export type LastOcrCache = {
  /** 用户 id；演示/未登录用 demo */
  userKey: string;
  draft: CachedOcrDraft;
  source: 'camera' | 'album' | null;
  /** 是否已确认保存到档案（与是否推送无关） */
  saved: boolean;
  savedArchiveId: string | null;
  recognizedAt: string;
};

const CACHE_KEY_PREFIX = 'senior_voice_last_ocr:';

function cacheKeyFor(userKey: string): string {
  return `${CACHE_KEY_PREFIX}${userKey || 'demo'}`;
}

function isDraftShape(value: unknown): value is CachedOcrDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const d = value as CachedOcrDraft;
  return (
    typeof d.diagnosis === 'string' &&
    typeof d.medicine === 'string' &&
    typeof d.visit_date === 'string' &&
    typeof d.visit_no === 'string' &&
    typeof d.raw_ocr_text === 'string'
  );
}

function isCacheShape(value: unknown): value is LastOcrCache {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const c = value as LastOcrCache;
  return (
    typeof c.userKey === 'string' &&
    isDraftShape(c.draft) &&
    (c.source === 'camera' || c.source === 'album' || c.source === null) &&
    typeof c.saved === 'boolean' &&
    (c.savedArchiveId === null || typeof c.savedArchiveId === 'string') &&
    typeof c.recognizedAt === 'string'
  );
}

/** 按用户标识读取最近一次识别缓存；互不影响 */
export function loadLastOcrCache(userKey: string): LastOcrCache | null {
  const key = cacheKeyFor(userKey);
  const raw = storageGet(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isCacheShape(parsed) || parsed.userKey !== userKey) {
      storageRemove(key);
      return null;
    }
    return parsed;
  } catch {
    storageRemove(key);
    return null;
  }
}

/**
 * 写入/覆盖该用户最近一次识别结果。
 * 登出不清除；其他用户的缓存各自独立。
 */
export function saveLastOcrCache(input: {
  userKey: string;
  draft: CachedOcrDraft;
  source: 'camera' | 'album' | null;
  saved?: boolean;
  savedArchiveId?: string | null;
  /** 新识别应传新时间；编辑草稿时不传以保留原识别时间 */
  recognizedAt?: string;
}): LastOcrCache {
  const userKey = input.userKey || 'demo';
  const prev = loadLastOcrCache(userKey);
  const next: LastOcrCache = {
    userKey,
    draft: {...input.draft},
    source: input.source,
    saved: input.saved ?? prev?.saved ?? false,
    savedArchiveId:
      input.savedArchiveId !== undefined
        ? input.savedArchiveId
        : (prev?.savedArchiveId ?? null),
    recognizedAt: input.recognizedAt || prev?.recognizedAt || new Date().toISOString(),
  };
  storageSet(cacheKeyFor(userKey), JSON.stringify(next));
  return next;
}

/** 仅清除指定用户缓存；登出不要调用 */
export function clearLastOcrCache(userKey: string): void {
  storageRemove(cacheKeyFor(userKey));
}
