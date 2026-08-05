/** 与后端 AuthService 一致：大陆 11 位手机号 */
const PHONE_PATTERN = /^1\d{10}$/;

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, '');
}

export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(normalizePhone(phone));
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}
