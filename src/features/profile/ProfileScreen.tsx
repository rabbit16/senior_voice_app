import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {text} from '../../shared/i18n/messages';
import {colors, radius, spacing, touch, typography} from '../../theme/tokens';

type Props = {
  phone: string;
  onLogout: () => void;
};

const ruleKeys = ['ruleRecordSaved', 'ruleAbnormal', 'ruleVisit'] as const;

export default function ProfileScreen({phone, onLogout}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const maskedPhone = phone.length > 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{text('zh', 'profileTitle')}</Text>

      <View style={styles.accountCard}>
        <View style={styles.avatar} accessibilityLabel={text('zh', 'accountInfo')}>
          <View style={styles.avatarHead} />
          <View style={styles.avatarBody} />
        </View>
        <View style={styles.accountText}>
          <Text style={styles.cardTitle}>{text('zh', 'accountInfo')}</Text>
          <Text style={styles.bodyText}>{maskedPhone}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Pressable accessibilityRole="button" onPress={() => setShowPassword(!showPassword)} style={styles.rowButton}>
          <Text style={styles.cardTitle}>{text('zh', 'changePassword')}</Text>
          <Text style={styles.chevron}>{showPassword ? '−' : '+'}</Text>
        </Pressable>
        {showPassword && <Text style={styles.bodyText}>{text('zh', 'passwordChanged')}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{text('zh', 'familyPush')}</Text>
        <Text style={styles.bodyText}>{text('zh', 'contactConfig')}</Text>
        <View style={styles.contactCard}>
          <View style={styles.contactDot} />
          <Text style={styles.contactText}>{text('zh', 'daughter')}</Text>
        </View>
        <View style={styles.contactCard}>
          <View style={styles.contactDot} />
          <Text style={styles.contactText}>{text('zh', 'son')}</Text>
        </View>
        <Pressable accessibilityRole="button" style={styles.addButton}>
          <Text style={styles.addText}>{text('zh', 'addContact')}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{text('zh', 'triggerRules')}</Text>
        {ruleKeys.map((rule, index) => (
          <View key={rule} style={styles.ruleRow}>
            <View style={[styles.switchTrack, index !== 1 && styles.switchOn]}>
              <View style={[styles.switchThumb, index !== 1 && styles.switchThumbOn]} />
            </View>
            <Text style={styles.ruleText}>{text('zh', rule)}</Text>
          </View>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>{text('zh', 'logout')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: colors.backgroundWarm},
  content: {padding: spacing.page, paddingBottom: spacing.xxxl},
  title: {...typography.title, color: colors.textPrimary, marginBottom: spacing.lg},
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
  rowButton: {
    minHeight: touch.minimum,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chevron: {fontSize: 34, lineHeight: 38, fontWeight: '700', color: colors.primary},
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 58,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundWarm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  contactDot: {width: 16, height: 16, borderRadius: 8, backgroundColor: colors.accent},
  contactText: {...typography.bodyStrong, color: colors.textPrimary},
  addButton: {
    minHeight: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  addText: {...typography.action, color: colors.success},
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
