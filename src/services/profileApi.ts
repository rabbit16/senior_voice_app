import {apiRequest} from './http';

export type UserPreferences = {
  preferred_lang: 'zh' | 'en';
};

export type FamilyRelation = 'daughter' | 'son' | 'other';

export type FamilyContact = {
  id: string;
  name: string;
  phone: string;
  email: string;
  relation?: FamilyRelation | string;
  notify_enabled: boolean;
  created_at: string;
};

export const ABNORMAL_METRICS = [
  'bmi',
  'blood_pressure',
  'blood_lipid',
  'blood_glucose',
  'liver',
  'kidney',
  'other',
] as const;

export type AbnormalMetric = (typeof ABNORMAL_METRICS)[number];

export type PushRules = {
  on_record_saved: boolean;
  on_abnormal: boolean;
  on_visit: boolean;
  abnormal_metrics: AbnormalMetric[];
};

export const DEFAULT_PUSH_RULES: PushRules = {
  on_record_saved: true,
  on_abnormal: false,
  on_visit: true,
  abnormal_metrics: [...ABNORMAL_METRICS],
};

export const MAX_FAMILY_CONTACTS = 10;

export function asBool(value: unknown, fallback = true): boolean {
  if (value === false || value === 0 || value === '0') {
    return false;
  }
  if (value === true || value === 1 || value === '1') {
    return true;
  }
  if (value == null) {
    return fallback;
  }
  return Boolean(value);
}

export function parseRelation(value: unknown): FamilyRelation {
  if (value === 'daughter' || value === 'son' || value === 'other') {
    return value;
  }
  return 'other';
}

export function normalizePushRules(raw: Partial<PushRules> | null | undefined): PushRules {
  const metrics = Array.isArray(raw?.abnormal_metrics)
    ? raw!.abnormal_metrics.filter((item): item is AbnormalMetric =>
        (ABNORMAL_METRICS as readonly string[]).includes(item),
      )
    : [...ABNORMAL_METRICS];
  return {
    on_record_saved: asBool(raw?.on_record_saved, DEFAULT_PUSH_RULES.on_record_saved),
    on_abnormal: asBool(raw?.on_abnormal, DEFAULT_PUSH_RULES.on_abnormal),
    on_visit: asBool(raw?.on_visit, DEFAULT_PUSH_RULES.on_visit),
    abnormal_metrics: metrics.length ? metrics : [...ABNORMAL_METRICS],
  };
}

export async function getPreferences(token: string): Promise<UserPreferences> {
  return apiRequest({
    method: 'GET',
    path: '/me/preferences',
    token,
  });
}

export async function updatePreferences(
  token: string,
  body: Partial<UserPreferences>,
): Promise<UserPreferences> {
  return apiRequest({
    method: 'PATCH',
    path: '/me/preferences',
    token,
    body,
  });
}

export async function listFamilyContacts(token: string): Promise<{items: FamilyContact[]}> {
  return apiRequest({
    method: 'GET',
    path: '/family/contacts',
    token,
  });
}

export async function createFamilyContact(
  token: string,
  body: {
    name: string;
    phone: string;
    email: string;
    relation?: FamilyRelation;
    notify_enabled?: boolean;
  },
): Promise<FamilyContact> {
  return apiRequest({
    method: 'POST',
    path: '/family/contacts',
    token,
    body,
  });
}

export async function updateFamilyContact(
  token: string,
  id: string,
  body: Partial<Pick<FamilyContact, 'name' | 'phone' | 'email' | 'relation' | 'notify_enabled'>>,
): Promise<FamilyContact> {
  return apiRequest({
    method: 'PATCH',
    path: `/family/contacts/${id}`,
    token,
    body,
  });
}

export async function deleteFamilyContact(token: string, id: string): Promise<{ok: true}> {
  return apiRequest({
    method: 'DELETE',
    path: `/family/contacts/${id}`,
    token,
  });
}

export async function getPushRules(token: string): Promise<PushRules> {
  const raw = await apiRequest<Partial<PushRules>>({
    method: 'GET',
    path: '/family/rules',
    token,
  });
  return normalizePushRules(raw);
}

export async function updatePushRules(token: string, body: PushRules): Promise<PushRules> {
  const raw = await apiRequest<Partial<PushRules>>({
    method: 'PUT',
    path: '/family/rules',
    token,
    body,
  });
  return normalizePushRules(raw);
}
