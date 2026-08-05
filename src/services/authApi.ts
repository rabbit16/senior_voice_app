import {apiRequest} from './http';

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
};

export type UserProfile = {
  id: string;
  phone: string;
  display_name?: string | null;
  preferred_lang: 'zh' | 'en';
  created_at: string;
};

export type SmsPurpose = 'login' | 'register' | 'reset_password';

export async function sendSmsCode(
  phone: string,
  purpose: SmsPurpose = 'login',
): Promise<{ok: true; expire_in: number}> {
  return apiRequest({
    method: 'POST',
    path: '/auth/sms/send',
    body: {phone, purpose},
  });
}

export async function loginWithSms(input: {
  phone: string;
  code: string;
  password?: string;
}): Promise<TokenPair & {user: UserProfile}> {
  return apiRequest({
    method: 'POST',
    path: '/auth/login/sms',
    body: input,
  });
}

/** 注册：手机号 + 验证码 + 密码，可选展示名（对齐 users 表） */
export async function registerWithSms(input: {
  phone: string;
  code: string;
  password: string;
  display_name?: string;
  preferred_lang?: 'zh' | 'en';
}): Promise<TokenPair & {user: UserProfile}> {
  return apiRequest({
    method: 'POST',
    path: '/auth/register',
    body: input,
  });
}

export async function loginWithPassword(input: {
  phone: string;
  password: string;
}): Promise<TokenPair & {user: UserProfile}> {
  return apiRequest({
    method: 'POST',
    path: '/auth/login/password',
    body: input,
  });
}

export async function changePassword(
  token: string,
  input: {old_password?: string; new_password: string},
): Promise<{ok: true}> {
  return apiRequest({
    method: 'POST',
    path: '/auth/password',
    token,
    body: input,
  });
}

export async function logout(token: string): Promise<{ok: true}> {
  return apiRequest({
    method: 'POST',
    path: '/auth/logout',
    token,
  });
}

export async function refreshToken(refresh_token: string): Promise<TokenPair> {
  return apiRequest({
    method: 'POST',
    path: '/auth/token/refresh',
    body: {refresh_token},
  });
}

export async function getMe(token: string): Promise<UserProfile> {
  return apiRequest({
    method: 'GET',
    path: '/me',
    token,
  });
}
