import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {isValidPassword, isValidPhone, normalizePhone} from '../../shared/auth/validators';
import {text} from '../../shared/i18n/messages';
import {registerWithSms, sendSmsCode} from '../../services/authApi';
import {ApiError} from '../../services/http';
import type {AuthSession} from '../../services/session';
import {moderateScale, screen, vScale} from '../../theme/layout';
import {colors, radius, spacing} from '../../theme/tokens';

type Props = {
  onRegister: (session: AuthSession) => void;
  onBackToLogin: () => void;
};

export default function RegisterScreen({onRegister, onBackToLogin}: Props) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
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
      const result = await sendSmsCode(trimmed, 'register');
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
    const trimmedPhone = normalizePhone(phone);
    const trimmedCode = code.trim();
    const trimmedName = displayName.trim();

    if (!trimmedPhone) {
      setError(text('zh', 'phoneError'));
      return;
    }
    if (!isValidPhone(trimmedPhone)) {
      setError(text('zh', 'phoneFormatError'));
      return;
    }
    if (!trimmedCode) {
      setError(text('zh', 'codeError'));
      return;
    }
    if (!password) {
      setError(text('zh', 'passwordError'));
      return;
    }
    if (!isValidPassword(password)) {
      setError(text('zh', 'passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(text('zh', 'passwordMismatch'));
      return;
    }

    setError('');
    setHint('');
    setLoading(true);
    try {
      const session = await registerWithSms({
        phone: trimmedPhone,
        code: trimmedCode,
        password,
        display_name: trimmedName || undefined,
        preferred_lang: 'zh',
      });
      onRegister(session);
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
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>{text('zh', 'registerTitle')}</Text>
            <Text style={styles.subtitle}>{text('zh', 'registerSubtitle')}</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              accessibilityLabel={text('zh', 'phoneLabel')}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              placeholder={text('zh', 'phonePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

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
              accessibilityLabel={text('zh', 'passwordLabel')}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder={text('zh', 'registerPasswordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <TextInput
              accessibilityLabel={text('zh', 'confirmPasswordLabel')}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={text('zh', 'confirmPasswordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <TextInput
              accessibilityLabel={text('zh', 'displayNameLabel')}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={text('zh', 'displayNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={error ? styles.errorText : styles.hint} numberOfLines={3}>
              {error || hint || text('zh', 'registerHint')}
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text('zh', 'registerButton')}
              disabled={loading}
              onPress={submit}
              style={[styles.primaryButton, loading && styles.disabledButton]}>
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryText}>{text('zh', 'registerButton')}</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text('zh', 'backToLogin')}
              disabled={loading}
              onPress={onBackToLogin}
              style={styles.linkButton}>
              <Text style={styles.linkText}>{text('zh', 'backToLogin')}</Text>
            </Pressable>
          </View>
        </ScrollView>
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
    scroll: {
      flexGrow: 1,
      paddingHorizontal: spacing.page,
      paddingTop: compact ? vScale(20) : vScale(28),
      paddingBottom: compact ? vScale(16) : vScale(24),
    },
    header: {
      minHeight: compact ? vScale(88) : vScale(100),
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
      flexGrow: 1,
      justifyContent: 'center',
      gap,
    },
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
    disabledButton: {opacity: 0.7},
  });
}
