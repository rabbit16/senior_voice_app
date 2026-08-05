import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Lang, text} from '../../../shared/i18n/messages';
import {colors, radius, spacing, typography} from '../../../theme/tokens';

type Props = {lang: Lang; content: string};

export default function ResultCard({lang, content}: Props) {
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.title}>{text(lang, 'resultTitle')}</Text>
      <Text selectable style={styles.content}>
        {content}
      </Text>
      <Text style={styles.note}>{text(lang, 'demoNote')}</Text>
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
  title: {...typography.cardTitle, color: colors.success},
  content: {...typography.bodyStrong, color: colors.textPrimary, marginTop: spacing.sm, fontWeight: '400'},
  note: {...typography.label, color: colors.textMuted, marginTop: spacing.md, fontWeight: '400'},
});
