import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Lang, text} from '../../../shared/i18n/messages';
import {QaPhase} from '../../../services/qaApi';
import {colors, radius, spacing, typography} from '../../../theme/tokens';

type Props = {lang: Lang; content: string; phase?: QaPhase};

export default function ResultCard({lang, content, phase}: Props) {
  const titleKey =
    phase === 'followup'
      ? 'followupTitle'
      : phase === 'emergency'
        ? 'emergencyTitle'
        : phase === 'diagnosis'
          ? 'diagnosisTitle'
          : 'resultTitle';
  const noteKey =
    phase === 'followup'
      ? 'followupHint'
      : phase === 'emergency'
        ? 'emergencyNote'
        : phase === 'diagnosis'
          ? 'diagnosisNote'
          : 'demoNote';

  return (
    <View
      style={[
        styles.card,
        phase === 'followup' && styles.followupCard,
        phase === 'emergency' && styles.emergencyCard,
      ]}
      accessibilityLiveRegion={phase === 'emergency' ? 'assertive' : 'polite'}>
      <Text
        style={[
          styles.title,
          phase === 'followup' && styles.followupTitle,
          phase === 'emergency' && styles.emergencyTitle,
        ]}>
        {text(lang, titleKey)}
      </Text>
      <Text
        selectable
        style={[styles.content, phase === 'emergency' && styles.emergencyContent]}>
        {content}
      </Text>
      <Text style={[styles.note, phase === 'emergency' && styles.emergencyNote]}>
        {text(lang, noteKey)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  followupCard: {
    backgroundColor: colors.surfaceBlue,
  },
  emergencyCard: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 2,
    borderColor: colors.danger,
  },
  title: {...typography.cardTitle, color: colors.success},
  followupTitle: {color: colors.primaryDark},
  emergencyTitle: {color: colors.dangerText},
  content: {...typography.bodyStrong, color: colors.textPrimary, marginTop: spacing.sm, fontWeight: '400'},
  emergencyContent: {color: colors.textPrimary, fontWeight: '600'},
  note: {...typography.label, color: colors.textMuted, marginTop: spacing.md, fontWeight: '400'},
  emergencyNote: {color: colors.dangerText, fontWeight: '600'},
});
