/**
 * 轻量本地存储：Web 用 localStorage，原生暂用内存（后续可接 AsyncStorage）。
 */
const memory = new Map<string, string>();

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function storageGet(key: string): string | null {
  if (canUseLocalStorage()) {
    return localStorage.getItem(key);
  }
  return memory.get(key) ?? null;
}

export function storageSet(key: string, value: string): void {
  if (canUseLocalStorage()) {
    localStorage.setItem(key, value);
    return;
  }
  memory.set(key, value);
}

export function storageRemove(key: string): void {
  if (canUseLocalStorage()) {
    localStorage.removeItem(key);
    return;
  }
  memory.delete(key);
}
