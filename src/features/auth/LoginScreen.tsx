import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {isValidPhone, normalizePhone} from '../../shared/auth/validators';
import {text} from '../../shared/i18n/messages';
import {loginWithPassword, loginWithSms, sendSmsCode} from '../../services/authApi';
import {ApiError} from '../../services/http';
import type {AuthSession} from '../../services/session';
import {moderateScale, screen, vScale} from '../../theme/layout';
import {colors, radius, spacing} from '../../theme/tokens';

type LoginMode = 'code' | 'password';

type Props = {
  onLogin: (session: AuthSession) => void;
  onGoRegister: () => void;
};

function createDemoSession(): AuthSession {
  return {
    access_token: 'demo-access-token',
    refresh_token: 'demo-refresh-token',
    token_type: 'bearer',
    expires_in: 86400,
    user: {
      id: 'demo_user',
      phone: '13800000000',
      display_name: '演示用户',
      preferred_lang: 'zh',
      created_at: new Date().toISOString(),
    },
  };
}

export default function LoginScreen({onLogin, onGoRegister}: Props) {
  const [mode, setMode] = useState<LoginMode>('code');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  const styles = useMemo(() => createStyles(screen.isShort), []);

  async function handleSendCode() {
    const trimmed = normalizePhone(phone);
    if (!trimmed) {
      setError(text('zh', 'phoneError'));
      return;
    }
    if (!isValidPhone(trimmed)) {
      setError(text('zh', 'phoneFormatError'));
      return;
    }
    setError('');
    setHint('');
    setSendingCode(true);
    try {
      const result = await sendSmsCode(trimmed, 'login');
      setHint(
        `${text('zh', 'codeSent').replace('{seconds}', String(result.expire_in))}。${text(
          'zh',
          'devCodeHint',
        )}`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : text('zh', 'networkError'));
    } finally {
      setSendingCode(false);
    }
  }

  async function submit() {
    const trimmed = normalizePhone(phone);
    if (!trimmed) {
      setError(text('zh', 'phoneError'));
      return;
    }
    if (!isValidPhone(trimmed)) {
      setError(text('zh', 'phoneFormatError'));
      return;
    }
    if (mode === 'code' && !code.trim()) {
      setError(text('zh', 'codeError'));
      return;
    }
    if (mode === 'password' && !password) {
      setError(text('zh', 'passwordError'));
      return;
    }

    setError('');
    setHint('');
    setLoading(true);
    try {
      const session =
        mode === 'code'
          ? await loginWithSms({
              phone: trimmed,
              code: code.trim(),
              password: newPassword.trim() || undefined,
            })
          : await loginWithPassword({phone: trimmed, password});
      onLogin(session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : text('zh', 'networkError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>{text('zh', 'loginTitle')}</Text>
            <Text style={styles.subtitle}>{text('zh', 'loginSubtitle')}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.segment} accessibilityRole="tablist">
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{selected: mode === 'code'}}
                onPress={() => setMode('code')}
                style={[styles.segmentButton, mode === 'code' && styles.segmentActive]}>
                <Text style={[styles.segmentText, mode === 'code' && styles.segmentActiveText]}>
                  {text('zh', 'codeLogin')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{selected: mode === 'password'}}
                onPress={() => setMode('password')}
                style={[styles.segmentButton, mode === 'password' && styles.segmentActive]}>
                <Text style={[styles.segmentText, mode === 'password' && styles.segmentActiveText]}>
                  {text('zh', 'passwordLogin')}
                </Text>
              </Pressable>
            </View>

            <TextInput
              accessibilityLabel={text('zh', 'phoneLabel')}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              placeholder={text('zh', 'phonePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            {mode === 'code' ? (
              <>
                <View style={styles.inlineRow}>
                  <TextInput
                    accessibilityLabel={text('zh', 'codeLabel')}
                    keyboardType="number-pad"
                    value={code}
                    onChangeText={setCode}
                    placeholder={text('zh', 'codePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, styles.flexInput]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={sendingCode}
                    onPress={handleSendCode}
                    style={[styles.secondaryButton, sendingCode && styles.disabledButton]}>
                    {sendingCode ? (
                      <ActivityIndicator color={colors.success} />
                    ) : (
                      <Text style={styles.secondaryText}>{text('zh', 'sendCode')}</Text>
                    )}
                  </Pressable>
                </View>
                <TextInput
                  accessibilityLabel={text('zh', 'setPasswordLabel')}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={`${text('zh', 'setPasswordPlaceholder')}（选填）`}
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
              </>
            ) : (
              <TextInput
                accessibilityLabel={text('zh', 'passwordLabel')}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder={text('zh', 'passwordPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
            )}

            <Text style={error ? styles.errorText : styles.hint} numberOfLines={2}>
              {error || hint || text('zh', 'loginHint')}
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text('zh', 'loginButton')}
              disabled={loading}
              onPress={submit}
              style={[styles.primaryButton, loading && styles.disabledButton]}>
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryText}>{text('zh', 'loginButton')}</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text('zh', 'goRegister')}
              disabled={loading}
              onPress={onGoRegister}
              style={styles.linkButton}>
              <Text style={styles.linkText}>{text('zh', 'goRegister')}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text('zh', 'demoEnter')}
              disabled={loading}
              onPress={() => onLogin(createDemoSession())}
              style={styles.demoButton}>
              <Text style={styles.demoText}>{text('zh', 'demoEnter')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(compact: boolean) {
  const gap = compact ? vScale(10) : vScale(12);
  const fieldHeight = compact ? Math.max(48, vScale(50)) : Math.max(52, vScale(54));
  const buttonHeight = compact ? Math.max(50, vScale(52)) : Math.max(54, vScale(58));
  const titleSize = compact ? moderateScale(24) : moderateScale(26);
  const bodySize = compact ? moderateScale(16) : moderateScale(17);

  return StyleSheet.create({
    safeArea: {flex: 1, backgroundColor: colors.backgroundWarm},
    flex: {flex: 1},
    page: {
      flex: 1,
      paddingHorizontal: spacing.page,
      paddingTop: compact ? vScale(20) : vScale(28),
      paddingBottom: compact ? vScale(16) : vScale(24),
    },
    header: {
      minHeight: compact ? vScale(96) : vScale(112),
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: gap,
      paddingHorizontal: spacing.md,
    },
    title: {
      fontSize: titleSize,
      lineHeight: titleSize + 10,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      width: '100%',
    },
    subtitle: {
      fontSize: bodySize,
      lineHeight: bodySize + 8,
      color: colors.textSecondary,
      textAlign: 'center',
      width: '100%',
      marginTop: spacing.sm,
    },
    form: {
      flex: 1,
      justifyContent: 'center',
      gap,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceBlue,
      borderRadius: radius.md,
      padding: 4,
    },
    segmentButton: {
      flex: 1,
      minHeight: fieldHeight,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: {backgroundColor: colors.primary},
    segmentText: {
      fontSize: bodySize,
      lineHeight: bodySize + 4,
      fontWeight: '700',
      color: colors.primaryDark,
    },
    segmentActiveText: {color: colors.surface},
    input: {
      minHeight: fieldHeight,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      fontSize: bodySize,
      color: colors.textPrimary,
    },
    inlineRow: {flexDirection: 'row', gap: spacing.sm, alignItems: 'center'},
    flexInput: {flex: 1},
    secondaryButton: {
      minHeight: fieldHeight,
      minWidth: compact ? 100 : 112,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentSoft,
    },
    secondaryText: {
      fontSize: moderateScale(14),
      lineHeight: moderateScale(20),
      fontWeight: '700',
      color: colors.success,
    },
    hint: {
      fontSize: moderateScale(14),
      lineHeight: moderateScale(20),
      color: colors.textSecondary,
      textAlign: 'center',
    },
    errorText: {
      fontSize: moderateScale(14),
      lineHeight: moderateScale(20),
      color: colors.dangerText,
      textAlign: 'center',
    },
    actions: {
      gap,
      marginTop: gap,
    },
    primaryButton: {
      minHeight: buttonHeight,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      fontSize: moderateScale(18),
      lineHeight: moderateScale(24),
      fontWeight: '700',
      color: colors.surface,
    },
    linkButton: {
      minHeight: Math.max(44, vScale(44)),
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkText: {
      fontSize: bodySize,
      lineHeight: bodySize + 4,
      fontWeight: '700',
      color: colors.primaryDark,
    },
    demoButton: {
      minHeight: buttonHeight,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceAmber,
      alignItems: 'center',
      justifyContent: 'center',
    },
    demoText: {
      fontSize: bodySize,
      lineHeight: bodySize + 4,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    disabledButton: {opacity: 0.7},
  });
}
