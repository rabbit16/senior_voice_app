/** 与后端 AuthService 一致：大陆 11 位手机号 */
const PHONE_PATTERN = /^1\d{10}$/;
/** 宽松邮箱：允许 QQ 邮箱及其它常见格式 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, '');
}

export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(normalizePhone(phone));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const value = normalizeEmail(email);
  return value.length > 0 && value.length <= 128 && EMAIL_PATTERN.test(value);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) {
    return trimmed;
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}
