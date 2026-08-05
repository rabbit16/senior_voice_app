import {apiRequest} from './http';

export type UserPreferences = {
  preferred_lang: 'zh' | 'en';
};

export type FamilyContact = {
  id: string;
  name: string;
  phone: string;
  relation?: string;
  created_at: string;
};

export type PushRules = {
  on_record_saved: boolean;
  on_abnormal: boolean;
  on_visit: boolean;
};

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
  body: {name: string; phone: string; relation?: string},
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
  body: Partial<Pick<FamilyContact, 'name' | 'phone' | 'relation'>>,
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
  return apiRequest({
    method: 'GET',
    path: '/family/rules',
    token,
  });
}

export async function updatePushRules(token: string, body: PushRules): Promise<PushRules> {
  return apiRequest({
    method: 'PUT',
    path: '/family/rules',
    token,
    body,
  });
}
