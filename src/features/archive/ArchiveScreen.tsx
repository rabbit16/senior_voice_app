import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {text} from '../../shared/i18n/messages';
import BackButton from '../../shared/components/BackButton';
import {colors, radius, spacing, typography} from '../../theme/tokens';

type ViewMode = 'home' | 'reports' | 'detail';

type HealthSummary = {
  id: string;
  title: string;
  examDate: string;
  examNo: string;
  summary: string;
};

type ReportItem = {
  id: string;
  name: string;
  date: string;
  org: string;
  voucher: string;
  badge: string;
};

type AbnormalItem = {
  title: string;
  suggestion: string;
};

const summaries: HealthSummary[] = [
  {
    id: 'sum1',
    title: '近期体检结果总结',
    examDate: '2025-11-03',
    examNo: '312101033225',
    summary: '体重指数偏低，血脂轻度异常。建议平衡膳食、适量运动，并按医嘱复查。',
  },
  {
    id: 'sum2',
    title: '上次随访结果总结',
    examDate: '2024-10-24',
    examNo: '312010241108',
    summary: '血压总体平稳，空腹血糖接近临界。建议继续监测早晚血压，控制饮食。',
  },
];

const healthIssues = [
  '体重指数偏低（BMI 18.2），需加强营养与适量运动',
  '血脂轻度异常，建议低脂饮食并定期复查',
  '空腹血糖接近临界，注意控制精制碳水',
  '近期有胸闷咳嗽复诊记录，需持续观察呼吸道症状',
];

const reports: ReportItem[] = [
  {
    id: 'r1',
    name: '毕小雪',
    date: '2025-11-03',
    org: '瑞慈体检上海静安机构',
    voucher: '312101033225',
    badge: '体检报告',
  },
  {
    id: 'r2',
    name: '毕小雪',
    date: '2024-10-24',
    org: '瑞慈体检上海静安机构',
    voucher: '312010241108',
    badge: '体检报告',
  },
  {
    id: 'r3',
    name: '毕小雪',
    date: '2023-04-10',
    org: '瑞慈体检上海徐汇机构',
    voucher: '312304101526',
    badge: '体检报告',
  },
];

const abnormalItems: AbnormalItem[] = [
  {
    title: '【1】体重过低。体重指数 BMI 值偏低（18.2）。',
    suggestion: '建议平衡膳食，适量运动，定期复查体重。',
  },
  {
    title: '【2】总胆固醇轻度升高。',
    suggestion: '建议低脂饮食，增加有氧运动，3 个月后复查血脂。',
  },
  {
    title: '【3】空腹血糖接近临界。',
    suggestion: '建议控制精制碳水摄入，监测血糖变化。',
  },
  {
    title: '【4】维生素 D 偏低。',
    suggestion: '建议适量日照，必要时遵医嘱补充。',
  },
];

export default function ArchiveScreen() {
  const [mode, setMode] = useState<ViewMode>('home');
  const [recognized, setRecognized] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [detailTab, setDetailTab] = useState<'abnormal' | 'full'>('abnormal');

  function startRecognize() {
    setRecognized(true);
    setSaved(false);
  }

  if (mode === 'detail' && selectedReport) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackButton label={text('zh', 'backToReports')} onPress={() => setMode('reports')} />

        <Text style={styles.detailName}>{selectedReport.name}</Text>
        <Text style={styles.metaLine}>
          {text('zh', 'examNoLabel')}：{selectedReport.voucher}
        </Text>
        <Text style={styles.metaLine}>
          {text('zh', 'examDateLabel')}：{selectedReport.date}
        </Text>

        <View style={styles.detailTabs}>
          <Pressable
            accessibilityRole="tab"
            onPress={() => setDetailTab('abnormal')}
            style={[styles.detailTab, detailTab === 'abnormal' && styles.detailTabActive]}>
            <Text style={[styles.detailTabText, detailTab === 'abnormal' && styles.detailTabTextActive]}>
              {text('zh', 'abnormalTab')}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{abnormalItems.length}项</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            onPress={() => setDetailTab('full')}
            style={[styles.detailTab, detailTab === 'full' && styles.detailTabActive]}>
            <Text style={[styles.detailTabText, detailTab === 'full' && styles.detailTabTextActive]}>
              {text('zh', 'fullReportTab')}
            </Text>
          </Pressable>
        </View>

        {detailTab === 'abnormal' ? (
          abnormalItems.map(item => (
            <View key={item.title} style={styles.abnormalCard}>
              <Text style={styles.abnormalTitle}>{item.title}</Text>
              <View style={styles.suggestionBox}>
                <Text style={styles.suggestionText}>{item.suggestion}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.fullCard}>
            <Text style={styles.fullText}>{text('zh', 'fullReportBody')}</Text>
          </View>
        )}

        <View style={styles.glossaryCard}>
          <Text style={styles.glossaryTitle}>{text('zh', 'glossaryTitle')}</Text>
          <Text style={styles.glossaryItem}>{text('zh', 'glossaryFollow')}</Text>
          <Text style={styles.glossaryItem}>{text('zh', 'glossaryTreat')}</Text>
          <Text style={styles.glossaryItem}>{text('zh', 'glossaryRecheck')}</Text>
        </View>
      </ScrollView>
    );
  }

  if (mode === 'reports') {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackButton label={text('zh', 'backToArchive')} onPress={() => setMode('home')} />
        <Text style={styles.title}>{text('zh', 'healthArchiveReport')}</Text>
        <Text style={styles.subtitle}>{text('zh', 'reportListSubtitle')}</Text>

        <View style={styles.reportList}>
          {reports.map((report, index) => {
            const isLast = index === reports.length - 1;
            return (
              <View key={report.id} style={styles.reportItem}>
                <View style={styles.reportRail}>
                  <View style={styles.reportDot} />
                  {!isLast && (
                    <View style={styles.reportDashTrack}>
                      {Array.from({length: 10}).map((_, dashIndex) => (
                        <View key={dashIndex} style={styles.reportDash} />
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.reportContent}>
                  <Text style={styles.reportDate}>{report.date}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${report.date} ${report.badge}`}
                    onPress={() => {
                      setSelectedReport(report);
                      setDetailTab('abnormal');
                      setMode('detail');
                    }}
                    style={styles.reportCard}>
                    <View style={styles.reportBadge}>
                      <Text style={styles.reportBadgeText}>{report.badge}</Text>
                    </View>
                    <Text style={styles.reportName}>{report.name}</Text>
                    <View style={styles.reportOrgRow}>
                      <View style={styles.orgIcon} />
                      <Text style={styles.reportOrg}>{report.org}</Text>
                    </View>
                    <Text style={styles.reportVoucher}>
                      {text('zh', 'examVoucherLabel')}：{report.voucher}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{text('zh', 'archiveTitle')}</Text>
      <Text style={styles.subtitle}>{text('zh', 'archiveSubtitle')}</Text>

      {/* 4、识别拍照最上面 */}
      <View style={styles.recognizeCard}>
        <View style={styles.cardHeader}>
          <View style={styles.documentIcon}>
            <View style={styles.docLineWide} />
            <View style={styles.docLine} />
            <View style={styles.docLineShort} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>{text('zh', 'recognizeCardTitle')}</Text>
            <Text style={styles.cardText}>{text('zh', 'recognizeCardText')}</Text>
          </View>
        </View>
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" onPress={startRecognize} style={styles.primaryButton}>
            <Text style={styles.primaryText}>{text('zh', 'cameraImport')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={startRecognize} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{text('zh', 'albumImport')}</Text>
          </Pressable>
        </View>
      </View>

      {recognized && (
        <View style={styles.resultCard}>
          <Text style={styles.cardTitle}>{text('zh', 'ocrResultTitle')}</Text>
          <InfoRow label={text('zh', 'diagnosisLabel')} value="支气管炎倾向，建议复查" />
          <InfoRow label={text('zh', 'medicineLabel')} value="按医嘱服用止咳药，注意饮水" />
          <InfoRow label={text('zh', 'dateLabel')} value="2026-07-27" />
          <Pressable accessibilityRole="button" onPress={() => setSaved(true)} style={styles.primaryButtonFull}>
            <Text style={styles.primaryText}>{text('zh', 'saveRecord')}</Text>
          </Pressable>
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" onPress={() => setSaved(true)} style={styles.secondaryButtonWide}>
              <Text style={styles.secondaryText}>{text('zh', 'pushChildren')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setSaved(true)} style={styles.secondaryButtonWide}>
              <Text style={styles.secondaryText}>{text('zh', 'exportPdf')}</Text>
            </Pressable>
          </View>
          {saved && <Text style={styles.savedText}>{text('zh', 'savedStatus')}</Text>}
        </View>
      )}

      {/* 5、中部：整合就诊记录，总结健康问题 */}
      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>{text('zh', 'healthProblemTitle')}</Text>
        <Text style={styles.metaLine}>
          {text('zh', 'examDateLabel')}：{summaries[0].examDate}
        </Text>
        <Text style={styles.metaLine}>
          {text('zh', 'examNoLabel')}：{summaries[0].examNo}
        </Text>
        <Text style={styles.summaryBody}>{text('zh', 'healthProblemBody')}</Text>
        {healthIssues.map(issue => (
          <View key={issue} style={styles.issueRow}>
            <View style={styles.issueDot} />
            <Text style={styles.issueText}>{issue}</Text>
          </View>
        ))}
      </View>

      {summaries.map(item => (
        <View key={item.id} style={styles.summaryCard}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.metaLine}>
            {text('zh', 'examDateLabel')}：{item.examDate}
          </Text>
          <Text style={styles.metaLine}>
            {text('zh', 'examNoLabel')}：{item.examNo}
          </Text>
          <Text style={styles.summaryBody}>{item.summary}</Text>
        </View>
      ))}

      {/* 6、健康档案报告放最下面；7、时间轴并入报告页 */}
      <Pressable
        accessibilityRole="button"
        onPress={() => setMode('reports')}
        style={styles.reportButton}>
        <Text style={styles.reportButtonText}>{text('zh', 'healthArchiveReport')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function InfoRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: colors.backgroundWarm},
  content: {padding: spacing.page, paddingBottom: spacing.xxxl},
  title: {...typography.title, color: colors.textPrimary},
  subtitle: {...typography.subtitle, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.lg},
  reportButton: {
    minHeight: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  reportButtonText: {...typography.action, color: colors.surface},
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  cardTitle: {...typography.cardTitle, color: colors.textPrimary},
  metaLine: {...typography.bodyLarge, color: colors.textSecondary, marginTop: spacing.sm},
  summaryBody: {...typography.bodyLarge, color: colors.textPrimary, marginTop: spacing.md},
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  issueDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    marginTop: 8,
  },
  issueText: {...typography.bodyLarge, color: colors.textSecondary, flex: 1},
  recognizeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  cardHeader: {flexDirection: 'row', gap: spacing.lg},
  documentIcon: {
    width: 72,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceBlue,
    padding: spacing.md,
    justifyContent: 'center',
  },
  docLineWide: {height: 8, borderRadius: 4, backgroundColor: colors.primary, marginBottom: spacing.sm},
  docLine: {height: 7, borderRadius: 4, backgroundColor: colors.primarySoft, marginBottom: spacing.sm},
  docLineShort: {width: 30, height: 7, borderRadius: 4, backgroundColor: colors.accent},
  headerText: {flex: 1},
  cardText: {...typography.bodyLarge, color: colors.textSecondary, marginTop: spacing.xs},
  actionRow: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg},
  primaryButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {...typography.action, color: colors.surface, textAlign: 'center'},
  secondaryButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {...typography.bodyStrong, color: colors.success, textAlign: 'center'},
  resultCard: {
    backgroundColor: colors.surfaceGreen,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  infoRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  infoLabel: {...typography.label, color: colors.textMuted},
  infoValue: {...typography.bodyStrong, color: colors.textPrimary, marginTop: spacing.xs},
  primaryButtonFull: {
    minHeight: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  secondaryButtonWide: {
    flex: 1,
    minHeight: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedText: {...typography.bodyStrong, color: colors.success, marginTop: spacing.lg},
  reportList: {marginTop: spacing.sm},
  reportItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 150,
  },
  reportRail: {
    width: 22,
    alignItems: 'center',
    marginRight: spacing.md,
  },
  reportDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    marginTop: 4,
    zIndex: 1,
  },
  reportDashTrack: {
    width: 2,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginTop: 4,
    marginBottom: 2,
    overflow: 'hidden',
  },
  reportDash: {
    width: 2,
    height: 6,
    borderRadius: 1,
    backgroundColor: '#7CC8B4',
  },
  reportContent: {flex: 1, paddingBottom: spacing.lg},
  reportDate: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    shadowColor: '#0B4F7F',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
    overflow: 'hidden',
  },
  reportBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.accent,
    borderBottomLeftRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  reportBadgeText: {...typography.label, color: colors.surface},
  reportName: {...typography.cardTitle, color: colors.textPrimary, paddingRight: 88},
  reportOrgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  orgIcon: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  reportOrg: {...typography.bodyLarge, color: colors.primary, flex: 1},
  reportVoucher: {...typography.bodyLarge, color: colors.textMuted, marginTop: spacing.sm},
  detailName: {...typography.title, color: colors.textPrimary, marginBottom: spacing.sm},
  detailTabs: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.md},
  detailTab: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  detailTabActive: {backgroundColor: colors.accent},
  detailTabText: {...typography.label, color: colors.textPrimary, textAlign: 'center'},
  detailTabTextActive: {color: colors.surface},
  badge: {
    position: 'absolute',
    top: 4,
    right: 6,
    backgroundColor: '#E67E22',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {fontSize: 11, lineHeight: 14, fontWeight: '700', color: colors.surface},
  abnormalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  abnormalTitle: {...typography.bodyStrong, color: colors.textPrimary},
  suggestionBox: {
    marginTop: spacing.md,
    backgroundColor: colors.backgroundWarm,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  suggestionText: {...typography.bodyLarge, color: colors.textSecondary},
  fullCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  fullText: {...typography.bodyLarge, color: colors.textSecondary},
  glossaryCard: {
    backgroundColor: colors.surfaceBlue,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  glossaryTitle: {...typography.bodyStrong, color: colors.accent, marginBottom: spacing.sm},
  glossaryItem: {...typography.bodyLarge, color: colors.textSecondary, marginTop: spacing.xs},
});
