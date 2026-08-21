import type {TokenPair, UserProfile} from './authApi';
import {storageGet, storageRemove, storageSet} from './storage';

export type AuthSession = TokenPair & {
  user: UserProfile;
};

const SESSION_KEY = 'senior_voice_auth_session';

let session: AuthSession | null = null;

function isSessionShape(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const s = value as AuthSession;
  return (
    typeof s.access_token === 'string' &&
    typeof s.refresh_token === 'string' &&
    typeof s.expires_in === 'number' &&
    !!s.user &&
    typeof s.user.id === 'string' &&
    typeof s.user.phone === 'string'
  );
}

/** 启动时从本地恢复登录态 */
export function loadSession(): AuthSession | null {
  if (session) {
    return session;
  }
  const raw = storageGet(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSessionShape(parsed)) {
      session = parsed;
      return session;
    }
  } catch {
    // ignore corrupt storage
  }
  storageRemove(SESSION_KEY);
  return null;
}

export function getSession(): AuthSession | null {
  return session ?? loadSession();
}

export function getAccessToken(): string | null {
  return getSession()?.access_token ?? null;
}

export function setSession(next: AuthSession | null): void {
  session = next;
  if (next) {
    storageSet(SESSION_KEY, JSON.stringify(next));
  } else {
    storageRemove(SESSION_KEY);
  }
}

export function clearSession(): void {
  // OCR 缓存按 userKey 分桶保留，登出不清空，下次登录同一用户可恢复
  setSession(null);
}
