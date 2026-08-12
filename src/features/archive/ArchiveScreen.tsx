import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {text} from '../../shared/i18n/messages';
import BackButton from '../../shared/components/BackButton';
import {
  createArchive,
  getHealthReport,
  listHealthReports,
  listHealthSummaries,
  type HealthReportDetail,
  type HealthReportListItem,
  type HealthSummary,
  type OcrResult,
  type ReportGlossaryItem,
} from '../../services/archiveApi';
import {ApiError} from '../../services/http';
import {getAccessToken} from '../../services/session';
import {colors, radius, spacing, typography} from '../../theme/tokens';

type ViewMode = 'home' | 'reports' | 'detail';

function isDemoToken(token: string | null): boolean {
  return !token || token.startsWith('demo-');
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return value.slice(0, 10);
}

/** 演示进入：保留原来的样例界面，不请求后端 */
const DEMO_SUMMARIES: HealthSummary[] = [
  {
    id: 'sum-problem',
    title: '健康问题总结',
    exam_date: '2025-11-03',
    exam_no: '312101033225',
    summary_text: '综合近期体检与就诊记录，当前需重点关注以下问题：',
    items: [
      {
        id: 'issue1',
        content: '体重指数偏低（BMI 18.2），需加强营养与适量运动',
        severity: 'medium',
        sort_order: 0,
      },
      {
        id: 'issue2',
        content: '血脂轻度异常，建议低脂饮食并定期复查',
        severity: 'medium',
        sort_order: 1,
      },
      {
        id: 'issue3',
        content: '空腹血糖接近临界，注意控制精制碳水',
        severity: 'low',
        sort_order: 2,
      },
      {
        id: 'issue4',
        content: '近期有胸闷咳嗽复诊记录，需持续观察呼吸道症状',
        severity: 'medium',
        sort_order: 3,
      },
    ],
    created_at: '2025-11-03T00:00:00Z',
    updated_at: '2025-11-03T00:00:00Z',
  },
  {
    id: 'sum1',
    title: '近期体检结果总结',
    exam_date: '2025-11-03',
    exam_no: '312101033225',
    summary_text: '体重指数偏低，血脂轻度异常。建议平衡膳食、适量运动，并按医嘱复查。',
    items: [],
    created_at: '2025-11-03T00:00:00Z',
    updated_at: '2025-11-03T00:00:00Z',
  },
  {
    id: 'sum2',
    title: '上次随访结果总结',
    exam_date: '2024-10-24',
    exam_no: '312010241108',
    summary_text: '血压总体平稳，空腹血糖接近临界。建议继续监测早晚血压，控制饮食。',
    items: [],
    created_at: '2024-10-24T00:00:00Z',
    updated_at: '2024-10-24T00:00:00Z',
  },
];

const DEMO_REPORTS: HealthReportListItem[] = [
  {
    id: 'r1',
    patient_name: '毕小雪',
    exam_date: '2025-11-03',
    org_name: '瑞慈体检上海静安机构',
    voucher_no: '312101033225',
    report_type: '体检报告',
  },
  {
    id: 'r2',
    patient_name: '毕小雪',
    exam_date: '2024-10-24',
    org_name: '瑞慈体检上海静安机构',
    voucher_no: '312010241108',
    report_type: '体检报告',
  },
  {
    id: 'r3',
    patient_name: '毕小雪',
    exam_date: '2023-04-10',
    org_name: '瑞慈体检上海徐汇机构',
    voucher_no: '312304101526',
    report_type: '体检报告',
  },
];

const DEMO_REPORT_DETAILS: Record<string, HealthReportDetail> = {
  r1: {
    ...DEMO_REPORTS[0],
    findings: [
      {
        id: 'f1',
        title: '【1】体重过低。体重指数 BMI 值偏低（18.2）。',
        suggestion: '建议平衡膳食，适量运动，定期复查体重。',
        risk_level: 'medium',
        sort_order: 0,
      },
      {
        id: 'f2',
        title: '【2】总胆固醇轻度升高。',
        suggestion: '建议低脂饮食，增加有氧运动，3 个月后复查血脂。',
        risk_level: 'medium',
        sort_order: 1,
      },
      {
        id: 'f3',
        title: '【3】空腹血糖接近临界。',
        suggestion: '建议控制精制碳水摄入，监测血糖变化。',
        risk_level: 'low',
        sort_order: 2,
      },
      {
        id: 'f4',
        title: '【4】维生素 D 偏低。',
        suggestion: '建议适量日照，必要时遵医嘱补充。',
        risk_level: 'low',
        sort_order: 3,
      },
    ],
    full_text:
      '一般检查：身高 160cm，体重 46.5kg，BMI 18.2。\n血脂：总胆固醇轻度升高。\n血糖：空腹血糖接近临界。\n维生素：维生素 D 偏低。\n主检建议：平衡膳食，适量运动，三个月后复查血脂与血糖。',
  },
  r2: {
    ...DEMO_REPORTS[1],
    findings: [
      {
        id: 'f5',
        title: '【1】空腹血糖接近临界。',
        suggestion: '建议控制精制碳水，继续监测血压与血糖。',
        risk_level: 'low',
        sort_order: 0,
      },
    ],
    full_text: '血压总体平稳。空腹血糖接近临界。建议继续早晚血压监测，控制饮食。',
  },
  r3: {
    ...DEMO_REPORTS[2],
    findings: [],
    full_text: '历次体检对比：体重偏低持续存在，建议加强营养。',
  },
};

const DEMO_OCR_RESULT: OcrResult = {
  diagnosis: '支气管炎倾向，建议复查',
  medicine: '按医嘱服用止咳药，注意饮水',
  visit_date: '2026-07-27',
  raw_ocr_text: '演示 OCR 全文：门诊病历……',
};

export default function ArchiveScreen() {
  const [mode, setMode] = useState<ViewMode>('home');
  const [summaries, setSummaries] = useState<HealthSummary[]>([]);
  const [reports, setReports] = useState<HealthReportListItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<HealthReportDetail | null>(null);
  const [detailTab, setDetailTab] = useState<'abnormal' | 'full'>('abnormal');

  const [homeLoading, setHomeLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoMode, setDemoMode] = useState(false);

  const [recognized, setRecognized] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedArchiveId, setSavedArchiveId] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    const token = getAccessToken();
    if (isDemoToken(token)) {
      setDemoMode(true);
      setSummaries(DEMO_SUMMARIES);
      setHomeLoading(false);
      setError('');
      return;
    }

    setDemoMode(false);
    setHomeLoading(true);
    setError('');
    try {
      const res = await listHealthSummaries(token!);
      setSummaries(res.items || []);
    } catch (err) {
      setSummaries([]);
      setError(err instanceof ApiError ? err.message : text('zh', 'archiveLoadFailed'));
    } finally {
      setHomeLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    const token = getAccessToken();
    if (isDemoToken(token)) {
      setDemoMode(true);
      setReports(DEMO_REPORTS);
      setReportsLoading(false);
      setError('');
      return;
    }

    setDemoMode(false);
    setReportsLoading(true);
    setError('');
    try {
      const res = await listHealthReports(token!, {page: 1, page_size: 50});
      setReports(res.items || []);
    } catch (err) {
      setReports([]);
      setError(err instanceof ApiError ? err.message : text('zh', 'archiveLoadFailed'));
    } finally {
      setReportsLoading(false);
    }
  }, []);

  const loadReportDetail = useCallback(async (id: string) => {
    const token = getAccessToken();
    if (isDemoToken(token)) {
      setDemoMode(true);
      setReportDetail(DEMO_REPORT_DETAILS[id] || null);
      setDetailLoading(false);
      setError(DEMO_REPORT_DETAILS[id] ? '' : text('zh', 'archiveEmptyDetail'));
      return;
    }

    setDemoMode(false);
    setDetailLoading(true);
    setError('');
    try {
      const detail = await getHealthReport(token!, id);
      setReportDetail(detail);
    } catch (err) {
      setReportDetail(null);
      setError(err instanceof ApiError ? err.message : text('zh', 'archiveLoadFailed'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  useEffect(() => {
    if (mode === 'reports') {
      loadReports();
    }
  }, [mode, loadReports]);

  useEffect(() => {
    if (mode === 'detail' && selectedReportId) {
      loadReportDetail(selectedReportId);
    }
  }, [mode, selectedReportId, loadReportDetail]);

  /** 演示模式展示样例 OCR；真实登录后待接图片选择器 */
  function startRecognize(_source: 'camera' | 'album') {
    const token = getAccessToken();
    if (isDemoToken(token)) {
      setError('');
      setOcrResult(DEMO_OCR_RESULT);
      setRecognized(true);
      setSaved(false);
      setSavedArchiveId(null);
      return;
    }
    setError(text('zh', 'ocrSoon'));
    setRecognized(false);
    setOcrResult(null);
    setSaved(false);
    setSavedArchiveId(null);
  }

  async function handleSaveArchive() {
    if (!ocrResult || saving) {
      return;
    }
    const token = getAccessToken();
    if (isDemoToken(token)) {
      setSaved(true);
      setSavedArchiveId('demo-archive');
      setError('');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const record = await createArchive(token!, {
        diagnosis: ocrResult.diagnosis,
        medicine: ocrResult.medicine,
        visit_date: ocrResult.visit_date,
        raw_ocr_text: ocrResult.raw_ocr_text,
      });
      setSaved(true);
      setSavedArchiveId(record.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : text('zh', 'archiveSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const problemSummary =
    summaries.find(item => (item.items?.length || 0) > 0) || summaries[0] || null;
  const otherSummaries = summaries.filter(item => item.id !== problemSummary?.id);

  const glossaryFallback: ReportGlossaryItem[] = [
    {id: 'g1', term: '随诊', definition: text('zh', 'glossaryFollow'), sort_order: 0},
    {id: 'g2', term: '诊治', definition: text('zh', 'glossaryTreat'), sort_order: 1},
    {id: 'g3', term: '复查', definition: text('zh', 'glossaryRecheck'), sort_order: 2},
  ];

  if (mode === 'detail') {
    const findings = reportDetail?.findings || [];
    const glossary =
      reportDetail?.glossary && reportDetail.glossary.length > 0
        ? reportDetail.glossary
        : glossaryFallback;

    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackButton
          label={text('zh', 'backToReports')}
          onPress={() => {
            setMode('reports');
            setSelectedReportId(null);
            setReportDetail(null);
          }}
        />

        {detailLoading ? (
          <LoadingBlock label={text('zh', 'archiveLoading')} />
        ) : reportDetail ? (
          <>
            <Text style={styles.detailName}>{reportDetail.patient_name}</Text>
            <Text style={styles.metaLine}>
              {text('zh', 'examNoLabel')}：{reportDetail.voucher_no}
            </Text>
            <Text style={styles.metaLine}>
              {text('zh', 'examDateLabel')}：{formatDate(reportDetail.exam_date)}
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
                  <Text style={styles.badgeText}>{findings.length}项</Text>
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
              findings.length ? (
                findings.map(item => (
                  <View key={item.id} style={styles.abnormalCard}>
                    <Text style={styles.abnormalTitle}>{item.title}</Text>
                    <View style={styles.suggestionBox}>
                      <Text style={styles.suggestionText}>{item.suggestion}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <EmptyBlock label={text('zh', 'archiveEmptyFindings')} />
              )
            ) : (
              <View style={styles.fullCard}>
                <Text style={styles.fullText}>
                  {reportDetail.full_text?.trim() || text('zh', 'fullReportBody')}
                </Text>
              </View>
            )}

            <View style={styles.glossaryCard}>
              <Text style={styles.glossaryTitle}>{text('zh', 'glossaryTitle')}</Text>
              {glossary.map(item => (
                <Text key={item.id} style={styles.glossaryItem}>
                  {item.definition.startsWith(item.term)
                    ? item.definition
                    : `${item.term}：${item.definition}`}
                </Text>
              ))}
            </View>
          </>
        ) : (
          <EmptyBlock label={error || text('zh', 'archiveEmptyDetail')} />
        )}

        {error && reportDetail ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    );
  }

  if (mode === 'reports') {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackButton label={text('zh', 'backToArchive')} onPress={() => setMode('home')} />
        <Text style={styles.title}>{text('zh', 'healthArchiveReport')}</Text>
        <Text style={styles.subtitle}>{text('zh', 'reportListSubtitle')}</Text>

        {reportsLoading ? (
          <LoadingBlock label={text('zh', 'archiveLoading')} />
        ) : error && !reports.length ? (
          <EmptyBlock label={error} onRetry={loadReports} />
        ) : !reports.length ? (
          <EmptyBlock label={text('zh', 'archiveEmptyReports')} onRetry={loadReports} />
        ) : (
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
                    <Text style={styles.reportDate}>{formatDate(report.exam_date)}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${report.exam_date} ${report.report_type}`}
                      onPress={() => {
                        setSelectedReportId(report.id);
                        setDetailTab('abnormal');
                        setReportDetail(null);
                        setMode('detail');
                      }}
                      style={styles.reportCard}>
                      <View style={styles.reportBadge}>
                        <Text style={styles.reportBadgeText}>{report.report_type}</Text>
                      </View>
                      <Text style={styles.reportName}>{report.patient_name}</Text>
                      <View style={styles.reportOrgRow}>
                        <View style={styles.orgIcon} />
                        <Text style={styles.reportOrg}>{report.org_name}</Text>
                      </View>
                      <Text style={styles.reportVoucher}>
                        {text('zh', 'examVoucherLabel')}：{report.voucher_no}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{text('zh', 'archiveTitle')}</Text>
      <Text style={styles.subtitle}>{text('zh', 'archiveSubtitle')}</Text>
      {demoMode ? <Text style={styles.demoNote}>{text('zh', 'archiveDemoNote')}</Text> : null}

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
          <Pressable
            accessibilityRole="button"
            onPress={() => startRecognize('camera')}
            style={styles.primaryButton}>
            <Text style={styles.primaryText}>{text('zh', 'cameraImport')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => startRecognize('album')}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{text('zh', 'albumImport')}</Text>
          </Pressable>
        </View>
      </View>

      {recognized && ocrResult ? (
        <View style={styles.resultCard}>
          <Text style={styles.cardTitle}>{text('zh', 'ocrResultTitle')}</Text>
          <InfoRow label={text('zh', 'diagnosisLabel')} value={ocrResult.diagnosis} />
          <InfoRow label={text('zh', 'medicineLabel')} value={ocrResult.medicine} />
          <InfoRow label={text('zh', 'dateLabel')} value={formatDate(ocrResult.visit_date)} />
          <Pressable
            accessibilityRole="button"
            disabled={saving || saved}
            onPress={handleSaveArchive}
            style={[styles.primaryButtonFull, (saving || saved) && styles.disabledButton]}>
            {saving ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryText}>{text('zh', 'saveRecord')}</Text>
            )}
          </Pressable>
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={!savedArchiveId}
              onPress={() => {
                if (demoMode) {
                  setSaved(true);
                  setError('');
                  return;
                }
                setError(text('zh', 'shareSoon'));
              }}
              style={styles.secondaryButtonWide}>
              <Text style={styles.secondaryText}>{text('zh', 'pushChildren')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!savedArchiveId}
              onPress={() => {
                if (demoMode) {
                  setSaved(true);
                  setError('');
                  return;
                }
                setError(text('zh', 'exportSoon'));
              }}
              style={styles.secondaryButtonWide}>
              <Text style={styles.secondaryText}>{text('zh', 'exportPdf')}</Text>
            </Pressable>
          </View>
          {saved ? <Text style={styles.savedText}>{text('zh', 'savedStatus')}</Text> : null}
        </View>
      ) : null}

      {homeLoading ? (
        <LoadingBlock label={text('zh', 'archiveLoading')} />
      ) : (
        <>
          {error && !summaries.length ? (
            <EmptyBlock label={error} onRetry={loadHome} />
          ) : null}

          {problemSummary ? (
            <View style={styles.summaryCard}>
              <Text style={styles.cardTitle}>
                {problemSummary.title || text('zh', 'healthProblemTitle')}
              </Text>
              <Text style={styles.metaLine}>
                {text('zh', 'examDateLabel')}：{formatDate(problemSummary.exam_date)}
              </Text>
              <Text style={styles.metaLine}>
                {text('zh', 'examNoLabel')}：{problemSummary.exam_no || '—'}
              </Text>
              <Text style={styles.summaryBody}>
                {problemSummary.summary_text || text('zh', 'healthProblemBody')}
              </Text>
              {(problemSummary.items || []).map(issue => (
                <View key={issue.id} style={styles.issueRow}>
                  <View style={styles.issueDot} />
                  <Text style={styles.issueText}>{issue.content}</Text>
                </View>
              ))}
            </View>
          ) : !error ? (
            <EmptyBlock label={text('zh', 'archiveEmptySummaries')} onRetry={loadHome} />
          ) : null}

          {otherSummaries.map(item => (
            <View key={item.id} style={styles.summaryCard}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.metaLine}>
                {text('zh', 'examDateLabel')}：{formatDate(item.exam_date)}
              </Text>
              <Text style={styles.metaLine}>
                {text('zh', 'examNoLabel')}：{item.exam_no || '—'}
              </Text>
              <Text style={styles.summaryBody}>{item.summary_text}</Text>
            </View>
          ))}
        </>
      )}

      {error && summaries.length ? <Text style={styles.errorText}>{error}</Text> : null}

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

function LoadingBlock({label}: {label: string}) {
  return (
    <View style={styles.stateBlock}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

function EmptyBlock({label, onRetry}: {label: string; onRetry?: () => void}) {
  return (
    <View style={styles.stateBlock}>
      <Text style={styles.stateText}>{label}</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>{text('zh', 'archiveRetry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: colors.backgroundWarm},
  content: {padding: spacing.page, paddingBottom: spacing.xxxl},
  title: {...typography.title, color: colors.textPrimary},
  subtitle: {...typography.subtitle, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.lg},
  demoNote: {
    ...typography.bodyLarge,
    color: colors.accent,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
  },
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
  disabledButton: {opacity: 0.7},
  savedText: {...typography.bodyStrong, color: colors.success, marginTop: spacing.lg},
  stateBlock: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  stateText: {...typography.bodyLarge, color: colors.textSecondary, textAlign: 'center'},
  retryButton: {
    marginTop: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {...typography.bodyStrong, color: colors.surface},
  errorText: {
    ...typography.bodyLarge,
    color: colors.dangerText,
    marginTop: spacing.md,
    textAlign: 'center',
  },
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
