import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {Lang, text} from '../../../shared/i18n/messages';
import {MedicalRecommendation} from '../../../services/qaApi';
import {moderateScale} from '../../../theme/layout';
import {colors, radius, spacing, typography} from '../../../theme/tokens';
import RecommendMarkdown from './RecommendMarkdown';

type Props = {
  lang: Lang;
  loading?: boolean;
  recommendation?: MedicalRecommendation | null;
};

/** 就医推荐卡片：原来的标题区 + 把 RAG 的 Markdown 收成适老化排版 */
export default function RecommendationCard({lang, loading, recommendation}: Props) {
  const title = recommendation?.title || text(lang, 'recommendationTitle');

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.title}>{title}</Text>
      {recommendation?.body ? (
        <>
          <RecommendMarkdown content={recommendation.body} />
          {loading ? (
            <Text style={styles.loadingText}>{text(lang, 'recommendLoading')}</Text>
          ) : (
            <Text style={styles.note}>{text(lang, 'demoNote')}</Text>
          )}
        </>
      ) : loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{text(lang, 'recommendLoading')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfacePurple,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  title: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    fontSize: moderateScale(20),
  },
  loading: {
    marginTop: spacing.md,
    alignItems: 'flex-start',
  },
  loadingText: {
    fontSize: moderateScale(16),
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  note: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.md,
    fontWeight: '400',
    fontSize: moderateScale(14),
  },
});
