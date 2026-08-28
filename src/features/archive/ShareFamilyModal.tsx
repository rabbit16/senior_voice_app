import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {text} from '../../shared/i18n/messages';
import {maskEmail} from '../../shared/auth/validators';
import {
  listFamilyContacts,
  asBool,
  parseRelation,
  type FamilyContact,
} from '../../services/profileApi';
import {loadDemoFamily} from '../../services/familyDemoStore';
import {ApiError} from '../../services/http';
import {getAccessToken} from '../../services/session';
import {colors, radius, spacing, typography} from '../../theme/tokens';

type Props = {
  visible: boolean;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (contactIds: string[], message: string) => void;
};

function isDemoToken(token: string | null): boolean {
  return !token || token.startsWith('demo-');
}

function maskPhone(phone: string): string {
  return phone.length > 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
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

export default function ShareFamilyModal({
  visible,
  submitting,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [contacts, setContacts] = useState<FamilyContact[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }
    setMessage('');
    setLoadError('');
    const token = getAccessToken();
    if (isDemoToken(token)) {
      const items = loadDemoFamily().contacts;
      setContacts(items);
      setSelected(Object.fromEntries(items.filter(item => item.notify_enabled).map(item => [item.id, true])));
      return;
    }
    setLoading(true);
    listFamilyContacts(token!)
      .then(result => {
        const items = (result.items || []).map(item => ({
          ...item,
          email: item.email || '',
          relation: parseRelation(item.relation),
          notify_enabled: asBool(item.notify_enabled, true),
        }));
        setContacts(items);
        setSelected(
          Object.fromEntries(items.filter(item => item.notify_enabled).map(item => [item.id, true])),
        );
      })
      .catch(err => {
        setContacts([]);
        setSelected({});
        setLoadError(err instanceof ApiError ? err.message : text('zh', 'familyLoadFailed'));
      })
      .finally(() => setLoading(false));
  }, [visible]);

  function toggle(id: string) {
    setSelected(prev => ({...prev, [id]: !prev[id]}));
  }

  const selectedIds = contacts.filter(item => selected[item.id]).map(item => item.id);
  const displayError = error || loadError;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{text('zh', 'shareTitle')}</Text>
            <Text style={styles.subtitle}>{text('zh', 'shareSubtitle')}</Text>
            <Text style={styles.hint}>{text('zh', 'shareByEmailHint')}</Text>

            {loading ? (
              <View style={styles.state}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : contacts.length === 0 ? (
              <Text style={styles.empty}>{text('zh', 'shareEmptyHint')}</Text>
            ) : (
              contacts.map(item => {
                const on = Boolean(selected[item.id]);
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{checked: on}}
                    onPress={() => toggle(item.id)}
                    style={[styles.contactRow, on && styles.contactRowOn]}>
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                    <View style={styles.contactText}>
                      <Text style={styles.contactName}>
                        {item.name} · {relationLabel(item.relation)}
                      </Text>
                      <Text style={styles.contactPhone}>{maskPhone(item.phone)}</Text>
                      {item.email ? (
                        <Text style={styles.contactPhone}>{maskEmail(item.email)}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}

            {contacts.length ? (
              <>
                <Text style={styles.fieldLabel}>{text('zh', 'shareMessageLabel')}</Text>
                <TextInput
                  accessibilityLabel={text('zh', 'shareMessageLabel')}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={text('zh', 'shareMessagePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={200}
                  style={styles.messageInput}
                />
              </>
            ) : null}

            {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting || loading || !contacts.length}
              onPress={() => onSubmit(selectedIds, message.trim())}
              style={[
                styles.primary,
                (submitting || loading || !contacts.length) && styles.disabled,
              ]}>
              {submitting ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryText}>{text('zh', 'shareConfirm')}</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={onClose}
              style={styles.cancel}>
              <Text style={styles.cancelText}>{text('zh', 'shareCancel')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 51, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.backgroundWarm,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
  },
  content: {padding: spacing.page, paddingBottom: spacing.xxxl},
  title: {...typography.title, color: colors.textPrimary},
  subtitle: {
    ...typography.subtitle,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.bodyLarge,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  state: {paddingVertical: spacing.xl, alignItems: 'center'},
  empty: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  contactRowOn: {backgroundColor: colors.surfaceGreen},
  check: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderNeutral,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkOn: {borderColor: colors.accent, backgroundColor: colors.accent},
  checkMark: {color: colors.surface, fontWeight: '800', fontSize: 16},
  contactText: {flex: 1},
  contactName: {...typography.bodyStrong, color: colors.textPrimary},
  contactPhone: {...typography.bodyLarge, color: colors.textSecondary},
  fieldLabel: {...typography.label, color: colors.textMuted, marginTop: spacing.md},
  messageInput: {
    minHeight: 88,
    marginTop: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderNeutral,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.bodyLarge,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  error: {
    ...typography.bodyLarge,
    color: colors.dangerText,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  primary: {
    minHeight: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  primaryText: {...typography.action, color: colors.surface},
  cancel: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  cancelText: {...typography.bodyStrong, color: colors.textSecondary},
  disabled: {opacity: 0.7},
});
