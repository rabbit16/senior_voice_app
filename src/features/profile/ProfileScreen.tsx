import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {isValidEmail, isValidPassword, isValidPhone, maskEmail, normalizeEmail, normalizePhone} from '../../shared/auth/validators';
import {text} from '../../shared/i18n/messages';
import {changePassword, updateMe} from '../../services/authApi';
import {
  ABNORMAL_METRICS,
  asBool,
  createFamilyContact,
  DEFAULT_PUSH_RULES,
  deleteFamilyContact,
  getPushRules,
  listFamilyContacts,
  MAX_FAMILY_CONTACTS,
  parseRelation,
  updateFamilyContact,
  updatePushRules,
  type AbnormalMetric,
  type FamilyContact,
  type FamilyRelation,
  type PushRules,
} from '../../services/profileApi';
import {loadDemoFamily, nextDemoContactId, saveDemoFamily} from '../../services/familyDemoStore';
import {ApiError} from '../../services/http';
import {getAccessToken, getSession, setSession} from '../../services/session';
import {colors, radius, spacing, touch, typography} from '../../theme/tokens';

type Props = {
  phone: string;
  onLogout: () => void;
};

const METRIC_LABELS: Record<AbnormalMetric, string> = {
  bmi: 'metricBmi',
  blood_pressure: 'metricBloodPressure',
  blood_lipid: 'metricBloodLipid',
  blood_glucose: 'metricBloodGlucose',
  liver: 'metricLiver',
  kidney: 'metricKidney',
  other: 'metricOther',
};

function isDemoToken(token: string | null): boolean {
  return !token || token.startsWith('demo-');
}

function maskPhone(value: string): string {
  return value.length > 7 ? `${value.slice(0, 3)}****${value.slice(-4)}` : value;
}

function relationLabel(relation: string | undefined): string {
  if (relation === 'daughter') {
    return text('zh', 'relationDaughter');
  }
  if (relation === 'son') {
    return text('zh', 'relationSon');
  }
  return text('zh', 'relationOther');
}

function emptyDraft(relation: FamilyRelation = 'daughter'): {
  name: string;
  phone: string;
  email: string;
  relation: FamilyRelation;
  notify_enabled: boolean;
} {
  return {
    name: relation === 'other' ? '' : relationLabel(relation),
    phone: '',
    email: '',
    relation,
    notify_enabled: true,
  };
}

export default function ProfileScreen({phone, onLogout}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [accountEmail, setAccountEmail] = useState(getSession()?.user.email || '');
  const [emailDraft, setEmailDraft] = useState(accountEmail);
  const [emailSaving, setEmailSaving] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [contacts, setContacts] = useState<FamilyContact[]>([]);
  const [rules, setRules] = useState<PushRules>(DEFAULT_PUSH_RULES);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const maskedPhone = maskPhone(phone);

  const loadFamily = useCallback(async () => {
    const token = getAccessToken();
    if (isDemoToken(token)) {
      const demo = loadDemoFamily();
      setDemoMode(true);
      setContacts(demo.contacts);
      setRules(demo.rules);
      setLoading(false);
      setError('');
      return;
    }

    setDemoMode(false);
    setLoading(true);
    setError('');
    try {
      const [contactResult, ruleResult] = await Promise.allSettled([
        listFamilyContacts(token!),
        getPushRules(token!),
      ]);
      if (contactResult.status === 'fulfilled') {
        setContacts(
          (contactResult.value.items || []).map(item => ({
            ...item,
            email: item.email || '',
            relation: parseRelation(item.relation),
            notify_enabled: asBool(item.notify_enabled, true),
          })),
        );
      } else {
        setContacts([]);
      }
      if (ruleResult.status === 'fulfilled') {
        setRules(ruleResult.value);
      }
      if (contactResult.status === 'rejected' && ruleResult.status === 'rejected') {
        const err = contactResult.reason;
        setError(err instanceof ApiError ? err.message : text('zh', 'familyLoadFailed'));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : text('zh', 'familyLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  function persistDemo(nextContacts: FamilyContact[], nextRules: PushRules) {
    saveDemoFamily({contacts: nextContacts, rules: nextRules});
  }

  function startAdd() {
    setEditingId(null);
    setDraft(emptyDraft('daughter'));
    setShowAdd(true);
    setPendingDeleteId(null);
    setError('');
    setNotice('');
  }

  function startEdit(item: FamilyContact) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      phone: item.phone,
      email: item.email || '',
      relation: parseRelation(item.relation),
      notify_enabled: asBool(item.notify_enabled, true),
    });
    setShowAdd(true);
    setPendingDeleteId(null);
    setError('');
    setNotice('');
  }

  function cancelForm() {
    setShowAdd(false);
    setEditingId(null);
    setDraft(emptyDraft());
  }

  function setRelation(relation: FamilyRelation) {
    setDraft(prev => {
      const wasDefault =
        !prev.name.trim() ||
        prev.name === text('zh', 'relationDaughter') ||
        prev.name === text('zh', 'relationSon') ||
        prev.name === text('zh', 'relationOther');
      return {
        ...prev,
        relation,
        name: wasDefault && relation !== 'other' ? relationLabel(relation) : prev.name,
      };
    });
  }

  async function handleSaveContact() {
    const name = draft.name.trim();
    const phoneValue = normalizePhone(draft.phone);
    if (!name) {
      setError(text('zh', 'contactNameRequired'));
      return;
    }
    if (!isValidPhone(phoneValue)) {
      setError(text('zh', 'phoneFormatError'));
      return;
    }
    const emailValue = normalizeEmail(draft.email);
    if (!emailValue) {
      setError(text('zh', 'contactEmailRequired'));
      return;
    }
    if (!isValidEmail(emailValue)) {
      setError(text('zh', 'emailFormatError'));
      return;
    }
    if (!editingId && contacts.length >= MAX_FAMILY_CONTACTS) {
      setError(text('zh', 'tooManyContacts'));
      return;
    }
    const duplicate = contacts.some(
      item => item.phone === phoneValue && item.id !== editingId,
    );
    if (duplicate) {
      setError(text('zh', 'contactPhoneConflict'));
      return;
    }
    const duplicateEmail = contacts.some(
      item => normalizeEmail(item.email || '') === emailValue && item.id !== editingId,
    );
    if (duplicateEmail) {
      setError(text('zh', 'contactEmailConflict'));
      return;
    }

    const token = getAccessToken();
    setSaving(true);
    setError('');
    try {
      if (isDemoToken(token)) {
        let next = contacts;
        if (editingId) {
          next = contacts.map(item =>
            item.id === editingId
              ? {
                  ...item,
                  name,
                  phone: phoneValue,
                  email: emailValue,
                  relation: draft.relation,
                  notify_enabled: draft.notify_enabled,
                }
              : item,
          );
        } else {
          next = [
            ...contacts,
            {
              id: nextDemoContactId(),
              name,
              phone: phoneValue,
              email: emailValue,
              relation: draft.relation,
              notify_enabled: draft.notify_enabled,
              created_at: new Date().toISOString(),
            },
          ];
        }
        setContacts(next);
        persistDemo(next, rules);
        setNotice(editingId ? text('zh', 'contactUpdated') : text('zh', 'contactAdded'));
        cancelForm();
        return;
      }

      const body = {
        name,
        phone: phoneValue,
        email: emailValue,
        relation: draft.relation,
        notify_enabled: draft.notify_enabled,
      };
      const saved = editingId
        ? await updateFamilyContact(token!, editingId, body)
        : await createFamilyContact(token!, body);
      const normalized = {
        ...saved,
        relation: parseRelation(saved.relation),
        notify_enabled: asBool(saved.notify_enabled, true),
      };
      setContacts(prev => {
        if (editingId) {
          return prev.map(item => (item.id === editingId ? normalized : item));
        }
        return [...prev, normalized];
      });
      setNotice(editingId ? text('zh', 'contactUpdated') : text('zh', 'contactAdded'));
      cancelForm();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'contact_phone_conflict') {
        setError(text('zh', 'contactPhoneConflict'));
      } else if (err instanceof ApiError && err.code === 'contact_email_conflict') {
        setError(text('zh', 'contactEmailConflict'));
      } else if (err instanceof ApiError && err.code === 'too_many_contacts') {
        setError(text('zh', 'tooManyContacts'));
      } else {
        setError(err instanceof ApiError ? err.message : text('zh', 'familyLoadFailed'));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      return;
    }
    const token = getAccessToken();
    setSaving(true);
    setError('');
    try {
      if (isDemoToken(token)) {
        const next = contacts.filter(item => item.id !== id);
        setContacts(next);
        persistDemo(next, rules);
      } else {
        await deleteFamilyContact(token!, id);
        setContacts(prev => prev.filter(item => item.id !== id));
      }
      setPendingDeleteId(null);
      setNotice(text('zh', 'contactDeleted'));
      if (editingId === id) {
        cancelForm();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : text('zh', 'familyLoadFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleNotify(item: FamilyContact) {
    const nextEnabled = !item.notify_enabled;
    const token = getAccessToken();
    setError('');
    try {
      if (isDemoToken(token)) {
        const next = contacts.map(row =>
          row.id === item.id ? {...row, notify_enabled: nextEnabled} : row,
        );
        setContacts(next);
        persistDemo(next, rules);
        return;
      }
      const saved = await updateFamilyContact(token!, item.id, {notify_enabled: nextEnabled});
      setContacts(prev =>
        prev.map(row =>
          row.id === item.id
            ? {...saved, relation: parseRelation(saved.relation), notify_enabled: asBool(saved.notify_enabled, true)}
            : row,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : text('zh', 'familyLoadFailed'));
    }
  }

  async function saveRules(next: PushRules) {
    const previous = rules;
    setRules(next);
    const token = getAccessToken();
    if (isDemoToken(token)) {
      persistDemo(contacts, next);
      setNotice(text('zh', 'rulesSaved'));
      return;
    }
    try {
      const saved = await updatePushRules(token!, next);
      setRules(saved);
      setNotice(text('zh', 'rulesSaved'));
      setError('');
    } catch (err) {
      setRules(previous);
      setError(err instanceof ApiError ? err.message : text('zh', 'rulesSaveFailed'));
    }
  }

  function toggleRule(key: 'on_record_saved' | 'on_abnormal' | 'on_visit') {
    const next = {...rules, [key]: !rules[key]};
    if (key === 'on_abnormal' && next.on_abnormal && !next.abnormal_metrics.length) {
      next.abnormal_metrics = [...ABNORMAL_METRICS];
    }
    saveRules(next);
  }

  function toggleMetric(metric: AbnormalMetric) {
    const has = rules.abnormal_metrics.includes(metric);
    const abnormal_metrics = has
      ? rules.abnormal_metrics.filter(item => item !== metric)
      : [...rules.abnormal_metrics, metric];
    if (!abnormal_metrics.length) {
      saveRules({...rules, on_abnormal: false, abnormal_metrics: [...ABNORMAL_METRICS]});
      return;
    }
    saveRules({...rules, on_abnormal: true, abnormal_metrics});
  }

  async function handleSavePassword() {
    if (!isValidPassword(newPassword)) {
      setError(text('zh', 'passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(text('zh', 'passwordMismatch'));
      return;
    }
    const token = getAccessToken();
    setPasswordSaving(true);
    setError('');
    try {
      if (isDemoToken(token)) {
        setNotice(text('zh', 'passwordChanged'));
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        return;
      }
      await changePassword(token!, {
        old_password: oldPassword.trim() || undefined,
        new_password: newPassword,
      });
      setNotice(text('zh', 'passwordChanged'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : text('zh', 'passwordSaveFailed'));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleSaveEmail() {
    const nextEmail = normalizeEmail(emailDraft);
    if (!nextEmail) {
      setError(text('zh', 'emailError'));
      return;
    }
    if (!isValidEmail(nextEmail)) {
      setError(text('zh', 'emailFormatError'));
      return;
    }
    const token = getAccessToken();
    setEmailSaving(true);
    setError('');
    try {
      if (isDemoToken(token)) {
        const session = getSession();
        if (session) {
          setSession({...session, user: {...session.user, email: nextEmail}});
        }
        setAccountEmail(nextEmail);
        setNotice(text('zh', 'emailUpdated'));
        return;
      }
      const user = await updateMe(token!, {email: nextEmail});
      const session = getSession();
      if (session) {
        setSession({...session, user: {...session.user, ...user}});
      }
      setAccountEmail(user.email || nextEmail);
      setNotice(text('zh', 'emailUpdated'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_conflict') {
        setError(text('zh', 'emailConflict'));
      } else {
        setError(err instanceof ApiError ? err.message : text('zh', 'emailFormatError'));
      }
    } finally {
      setEmailSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{text('zh', 'profileTitle')}</Text>
      {demoMode ? <Text style={styles.demoNote}>{text('zh', 'familyDemoNote')}</Text> : null}

      <View style={styles.accountCard}>
        <View style={styles.avatar} accessibilityLabel={text('zh', 'accountInfo')}>
          <View style={styles.avatarHead} />
          <View style={styles.avatarBody} />
        </View>
        <View style={styles.accountText}>
          <Text style={styles.cardTitle}>{text('zh', 'accountInfo')}</Text>
          <Text style={styles.bodyText}>{maskedPhone}</Text>
          <Text style={styles.bodyText}>
            {accountEmail ? maskEmail(accountEmail) : text('zh', 'emailPlaceholder')}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setShowEmail(!showEmail);
            setEmailDraft(accountEmail);
          }}
          style={styles.rowButton}>
          <Text style={styles.cardTitle}>{text('zh', 'changeEmail')}</Text>
          <Text style={styles.chevron}>{showEmail ? '−' : '+'}</Text>
        </Pressable>
        {showEmail ? (
          <View>
            <Text style={styles.fieldLabel}>{text('zh', 'emailLabel')}</Text>
            <TextInput
              accessibilityLabel={text('zh', 'emailLabel')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={emailDraft}
              onChangeText={setEmailDraft}
              placeholder={text('zh', 'emailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.fieldInput}
            />
            <Pressable
              accessibilityRole="button"
              disabled={emailSaving}
              onPress={handleSaveEmail}
              style={[styles.primaryButton, emailSaving && styles.disabledButton]}>
              {emailSaving ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryText}>{text('zh', 'saveEmail')}</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowPassword(!showPassword)}
          style={styles.rowButton}>
          <Text style={styles.cardTitle}>{text('zh', 'changePassword')}</Text>
          <Text style={styles.chevron}>{showPassword ? '−' : '+'}</Text>
        </Pressable>
        {showPassword ? (
          <View>
            <Text style={styles.fieldLabel}>{text('zh', 'oldPasswordLabel')}</Text>
            <TextInput
              accessibilityLabel={text('zh', 'oldPasswordLabel')}
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder={text('zh', 'passwordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.fieldInput}
            />
            <Text style={styles.fieldLabel}>{text('zh', 'newPasswordLabel')}</Text>
            <TextInput
              accessibilityLabel={text('zh', 'newPasswordLabel')}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={text('zh', 'setPasswordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.fieldInput}
            />
            <Text style={styles.fieldLabel}>{text('zh', 'confirmNewPasswordLabel')}</Text>
            <TextInput
              accessibilityLabel={text('zh', 'confirmNewPasswordLabel')}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={text('zh', 'confirmPasswordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.fieldInput}
            />
            <Pressable
              accessibilityRole="button"
              disabled={passwordSaving}
              onPress={handleSavePassword}
              style={[styles.primaryButton, passwordSaving && styles.disabledButton]}>
              {passwordSaving ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryText}>{text('zh', 'savePassword')}</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{text('zh', 'familyPush')}</Text>
        <Text style={styles.bodyText}>{text('zh', 'contactConfig')}</Text>

        {loading ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {contacts.length === 0 && !showAdd ? (
              <Text style={styles.emptyText}>{text('zh', 'contactEmpty')}</Text>
            ) : null}
            {contacts.map(item => (
              <View key={item.id} style={styles.contactCard}>
                <View style={styles.contactMain}>
                  <View style={styles.contactDot} />
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactText}>
                      {item.name} · {relationLabel(item.relation)}
                    </Text>
                    <Text style={styles.contactPhone}>{maskPhone(item.phone)}</Text>
                    {item.email ? (
                      <Text style={styles.contactPhone}>{maskEmail(item.email)}</Text>
                    ) : null}
                  </View>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{checked: item.notify_enabled}}
                  onPress={() => handleToggleNotify(item)}
                  style={styles.notifyRow}>
                  <View style={[styles.switchTrack, item.notify_enabled && styles.switchOn]}>
                    <View
                      style={[styles.switchThumb, item.notify_enabled && styles.switchThumbOn]}
                    />
                  </View>
                  <Text style={styles.notifyLabel}>{text('zh', 'notifyEnabled')}</Text>
                </Pressable>
                <View style={styles.contactActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => startEdit(item)}
                    style={styles.smallButton}>
                    <Text style={styles.smallButtonText}>{text('zh', 'editContactButton')}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => handleDelete(item.id)}
                    style={[
                      styles.smallButton,
                      pendingDeleteId === item.id && styles.dangerButton,
                    ]}>
                    <Text
                      style={[
                        styles.smallButtonText,
                        pendingDeleteId === item.id && styles.dangerButtonText,
                      ]}>
                      {pendingDeleteId === item.id
                        ? text('zh', 'confirmDeleteContact')
                        : text('zh', 'deleteContact')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {showAdd ? (
          <View style={styles.formBox}>
            <Text style={styles.fieldLabel}>{text('zh', 'contactRelationLabel')}</Text>
            <View style={styles.relationRow}>
              {(['daughter', 'son', 'other'] as FamilyRelation[]).map(item => {
                const active = draft.relation === item;
                const labelKey =
                  item === 'daughter'
                    ? 'relationDaughter'
                    : item === 'son'
                      ? 'relationSon'
                      : 'relationOther';
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    onPress={() => setRelation(item)}
                    style={[styles.relationChip, active && styles.relationChipOn]}>
                    <Text style={[styles.relationChipText, active && styles.relationChipTextOn]}>
                      {text('zh', labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.fieldLabel}>{text('zh', 'contactNameLabel')}</Text>
            <TextInput
              accessibilityLabel={text('zh', 'contactNameLabel')}
              value={draft.name}
              onChangeText={value => setDraft(prev => ({...prev, name: value}))}
              placeholder={text('zh', 'contactNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.fieldInput}
            />
            <Text style={styles.fieldLabel}>{text('zh', 'contactPhoneLabel')}</Text>
            <TextInput
              accessibilityLabel={text('zh', 'contactPhoneLabel')}
              value={draft.phone}
              onChangeText={value => setDraft(prev => ({...prev, phone: value}))}
              placeholder={text('zh', 'contactPhonePlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              style={styles.fieldInput}
            />
            <Text style={styles.fieldLabel}>{text('zh', 'contactEmailLabel')}</Text>
            <TextInput
              accessibilityLabel={text('zh', 'contactEmailLabel')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={draft.email}
              onChangeText={value => setDraft(prev => ({...prev, email: value}))}
              placeholder={text('zh', 'contactEmailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.fieldInput}
            />
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{checked: draft.notify_enabled}}
              onPress={() => setDraft(prev => ({...prev, notify_enabled: !prev.notify_enabled}))}
              style={styles.ruleRow}>
              <View style={[styles.switchTrack, draft.notify_enabled && styles.switchOn]}>
                <View style={[styles.switchThumb, draft.notify_enabled && styles.switchThumbOn]} />
              </View>
              <Text style={styles.ruleText}>{text('zh', 'notifyEnabled')}</Text>
            </Pressable>
            <Text style={styles.hintText}>{text('zh', 'notifyHint')}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={handleSaveContact}
              style={[styles.primaryButton, saving && styles.disabledButton]}>
              {saving ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryText}>
                  {editingId ? text('zh', 'editContact') : text('zh', 'addContact')}
                </Text>
              )}
            </Pressable>
            <Pressable accessibilityRole="button" onPress={cancelForm} style={styles.cancelButton}>
              <Text style={styles.cancelText}>{text('zh', 'cancelEdit')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={contacts.length >= MAX_FAMILY_CONTACTS}
            onPress={startAdd}
            style={[
              styles.addButton,
              contacts.length >= MAX_FAMILY_CONTACTS && styles.disabledButton,
            ]}>
            <Text style={styles.addText}>{text('zh', 'addContact')}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{text('zh', 'triggerRules')}</Text>
        <RuleSwitch
          on={rules.on_record_saved}
          label={text('zh', 'ruleRecordSaved')}
          onPress={() => toggleRule('on_record_saved')}
        />
        <RuleSwitch
          on={rules.on_abnormal}
          label={text('zh', 'ruleAbnormal')}
          onPress={() => toggleRule('on_abnormal')}
        />
        {rules.on_abnormal ? (
          <View style={styles.metricBox}>
            <Text style={styles.metricTitle}>{text('zh', 'metricTitle')}</Text>
            <Text style={styles.hintText}>{text('zh', 'metricHint')}</Text>
            {ABNORMAL_METRICS.map(metric => {
              const on = rules.abnormal_metrics.includes(metric);
              return (
                <Pressable
                  key={metric}
                  accessibilityRole="checkbox"
                  accessibilityState={{checked: on}}
                  onPress={() => toggleMetric(metric)}
                  style={styles.metricRow}>
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.ruleText}>{text('zh', METRIC_LABELS[metric])}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <RuleSwitch
          on={rules.on_visit}
          label={text('zh', 'ruleVisit')}
          onPress={() => toggleRule('on_visit')}
        />
      </View>

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable accessibilityRole="button" onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>{text('zh', 'logout')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function RuleSwitch({
  on,
  label,
  onPress,
}: {
  on: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{checked: on}}
      onPress={onPress}
      style={styles.ruleRow}>
      <View style={[styles.switchTrack, on && styles.switchOn]}>
        <View style={[styles.switchThumb, on && styles.switchThumbOn]} />
      </View>
      <Text style={styles.ruleText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: colors.backgroundWarm},
  content: {padding: spacing.page, paddingBottom: spacing.xxxl},
  title: {...typography.title, color: colors.textPrimary, marginBottom: spacing.lg},
  demoNote: {
    ...typography.bodyLarge,
    color: colors.accent,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
  },
  accountCard: {
    flexDirection: 'row',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfacePurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHead: {width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary},
  avatarBody: {
    width: 46,
    height: 22,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
  },
  accountText: {flex: 1},
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  cardTitle: {...typography.cardTitle, color: colors.textPrimary},
  bodyText: {...typography.bodyLarge, color: colors.textSecondary, marginTop: spacing.md},
  emptyText: {...typography.bodyLarge, color: colors.textSecondary, marginTop: spacing.md},
  hintText: {...typography.bodyLarge, color: colors.textMuted, marginTop: spacing.sm},
  rowButton: {
    minHeight: touch.minimum,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chevron: {fontSize: 34, lineHeight: 38, fontWeight: '700', color: colors.primary},
  fieldLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  fieldInput: {
    minHeight: 54,
    marginTop: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundWarm,
    borderWidth: 1,
    borderColor: colors.borderNeutral,
    paddingHorizontal: spacing.lg,
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  primaryText: {...typography.action, color: colors.surface},
  disabledButton: {opacity: 0.7},
  contactCard: {
    borderRadius: radius.md,
    backgroundColor: colors.backgroundWarm,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  contactMain: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  contactDot: {width: 16, height: 16, borderRadius: 8, backgroundColor: colors.accent},
  contactInfo: {flex: 1},
  contactText: {...typography.bodyStrong, color: colors.textPrimary},
  contactPhone: {...typography.bodyLarge, color: colors.textSecondary},
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    minHeight: 44,
  },
  notifyLabel: {...typography.bodyLarge, color: colors.textPrimary, flex: 1},
  contactActions: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md},
  smallButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  smallButtonText: {...typography.bodyStrong, color: colors.primary, textAlign: 'center'},
  dangerButton: {backgroundColor: colors.dangerSoft},
  dangerButtonText: {color: colors.dangerText},
  addButton: {
    minHeight: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  addText: {...typography.action, color: colors.success},
  formBox: {marginTop: spacing.md},
  relationRow: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm},
  relationChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relationChipOn: {backgroundColor: colors.primary},
  relationChipText: {...typography.bodyStrong, color: colors.primaryDark},
  relationChipTextOn: {color: colors.surface},
  cancelButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  cancelText: {...typography.bodyStrong, color: colors.textSecondary},
  ruleRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg},
  switchTrack: {
    width: 58,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.borderNeutral,
    padding: 3,
  },
  switchOn: {backgroundColor: colors.accent},
  switchThumb: {width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface},
  switchThumbOn: {marginLeft: 24},
  ruleText: {...typography.bodyLarge, color: colors.textPrimary, flex: 1},
  metricBox: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  metricTitle: {...typography.bodyStrong, color: colors.textPrimary},
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    marginTop: spacing.sm,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderNeutral,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkOn: {borderColor: colors.accent, backgroundColor: colors.accent},
  checkMark: {color: colors.surface, fontWeight: '800', fontSize: 15},
  stateBlock: {paddingVertical: spacing.lg, alignItems: 'center'},
  noticeText: {
    ...typography.bodyStrong,
    color: colors.success,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  errorText: {
    ...typography.bodyLarge,
    color: colors.dangerText,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  logoutButton: {
    minHeight: 60,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  logoutText: {...typography.action, color: colors.dangerText},
});
