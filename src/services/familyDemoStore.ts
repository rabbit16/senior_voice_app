import {
  DEFAULT_PUSH_RULES,
  type FamilyContact,
  type FamilyRelation,
  type PushRules,
} from './profileApi';
import {storageGet, storageSet} from './storage';

const KEY = 'demo_family_v2';

export type DemoFamilyState = {
  contacts: FamilyContact[];
  rules: PushRules;
};

function nowIso(): string {
  return new Date().toISOString();
}

function defaultState(): DemoFamilyState {
  const created_at = nowIso();
  return {
    contacts: [
      {
        id: 'demo-ctc-daughter',
        name: '女儿 王女士',
        phone: '13900000001',
        email: 'daughter@qq.com',
        relation: 'daughter',
        notify_enabled: true,
        created_at,
      },
      {
        id: 'demo-ctc-son',
        name: '儿子 李先生',
        phone: '13900000002',
        email: 'son@qq.com',
        relation: 'son',
        notify_enabled: true,
        created_at,
      },
    ],
    rules: {...DEFAULT_PUSH_RULES},
  };
}

export function loadDemoFamily(): DemoFamilyState {
  const raw = storageGet(KEY);
  if (!raw) {
    return defaultState();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<DemoFamilyState>;
    const contacts = Array.isArray(parsed.contacts) ? parsed.contacts : defaultState().contacts;
    return {
      contacts: contacts.map(item => ({
        ...item,
        notify_enabled: item.notify_enabled !== false,
        email: item.email || '',
        relation: (item.relation as FamilyRelation) || 'other',
      })),
      rules: {
        ...DEFAULT_PUSH_RULES,
        ...(parsed.rules || {}),
        abnormal_metrics: parsed.rules?.abnormal_metrics?.length
          ? parsed.rules.abnormal_metrics
          : DEFAULT_PUSH_RULES.abnormal_metrics,
      },
    };
  } catch {
    return defaultState();
  }
}

export function saveDemoFamily(state: DemoFamilyState): void {
  storageSet(KEY, JSON.stringify(state));
}

export function nextDemoContactId(): string {
  return `demo-ctc-${Date.now()}`;
}
