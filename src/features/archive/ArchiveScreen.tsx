import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {text} from '../../shared/i18n/messages';
import BackButton from '../../shared/components/BackButton';
import {
  getArchive,
  getHealthReport,
  listArchives,
  listHealthReports,
  listHealthSummaries,
  ocrArchiveImage,
  type ArchiveRecord,
  type HealthReportDetail,
  type HealthReportListItem,
  type HealthSummary,
  type OcrResult,
  type ReportGlossaryItem,
} from '../../services/archiveApi';
import {ApiError} from '../../services/http';
import {loadLastOcrCache, saveLastOcrCache} from '../../services/ocrCache';
import {isImagePickCancelled, pickImage} from '../../services/pickImage';
import {getAccessToken, getSession} from '../../services/session';
import {colors, radius, spacing, typography} from '../../theme/tokens';

type ViewMode = 'home' | 'reports' | 'detail' | 'confirm';

type OcrDraft = {
  diagnosis: string;
  medicine: string;
  visit_date: string;
  visit_no: string;
  raw_ocr_text: string;
  document_type: 'visit' | 'exam';
  patient_name: string;
  org_name: string;
  voucher_no: string;
  report_type: string;
};

function emptyDraft(): OcrDraft {
  return {
    diagnosis: '',
    medicine: '',
    visit_date: '',
    visit_no: '',
    raw_ocr_text: '',
    document_type: 'visit',
    patient_name: '',
    org_name: '',
    voucher_no: '',
    report_type: '',
  };
}

function draftFromOcr(result: OcrResult): OcrDraft {
  return {
    diagnosis: result.diagnosis || '',
    medicine: result.medicine || '',
    visit_date: (result.visit_date || '').slice(0, 10),
    visit_no: result.visit_no || '',
    raw_ocr_text: result.raw_ocr_text || '',
    document_type: result.document_type === 'exam' ? 'exam' : 'visit',
    patient_name: result.patient_name || '',
    org_name: result.org_name || '',
    voucher_no: result.voucher_no || '',
    report_type: result.report_type || '',
  };
}

function cacheUserKey(): string {
  return getSession()?.user?.id || 'demo';
}

function isDraftFilled(draft: OcrDraft): boolean {
  return Boolean(
    draft.visit_no.trim() ||
      draft.diagnosis.trim() ||
      draft.medicine.trim() ||
      draft.visit_date.trim() ||
      draft.raw_ocr_text.trim(),
  );
}

function isDemoToken(token: string | null): boolean {
  return !token || token.startsWith('demo-');
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return value.slice(0, 10);
}

type TimelineKind = 'report' | 'visit';

type SelectedItem = {
  kind: TimelineKind;
  id: string;
};

type TimelineItem = {
  key: string;
  kind: TimelineKind;
  id: string;
  date: string;
  badge: string;
  title: string;
  subtitle: string;
  voucherLabel: string;
  voucherNo: string;
};

function toTimelineItem(
  kind: TimelineKind,
  id: string,
  date: string,
  badge: string,
  title: string,
  subtitle: string,
  voucherLabel: string,
  voucherNo: string,
): TimelineItem {
  return {
    key: `${kind}:${id}`,
    kind,
    id,
    date,
    badge,
    title,
    subtitle,
    voucherLabel,
    voucherNo,
  };
}

function reportToTimelineItem(report: HealthReportListItem): TimelineItem {
  return toTimelineItem(
    'report',
    report.id,
    report.exam_date,
    report.report_type || text('zh', 'healthArchiveReport'),
    report.patient_name,
    report.org_name,
    text('zh', 'examVoucherLabel'),
    report.voucher_no,
  );
}

function visitToTimelineItem(visit: ArchiveRecord): TimelineItem {
  return toTimelineItem(
    'visit',
    visit.id,
    visit.visit_date,
    text('zh', 'visitTypeBadge'),
    visit.diagnosis,
    visit.medicine,
    text('zh', 'visitNoLabel'),
    visit.visit_no,
  );
}

function mergeTimeline(
  reports: HealthReportListItem[],
  visits: ArchiveRecord[],
): TimelineItem[] {
  const items = [
    ...reports.map(reportToTimelineItem),
    ...visits.map(visitToTimelineItem),
  ];
  items.sort((a, b) => {
    const byDate = formatDate(b.date).localeCompare(formatDate(a.date));
    if (byDate !== 0) {
      return byDate;
    }
    return a.key.localeCompare(b.key);
  });
  return items;
}

function upsertVisit(list: ArchiveRecord[], record: ArchiveRecord): ArchiveRecord[] {
  const byVisitNo = list.findIndex(item => item.visit_no === record.visit_no);
  if (byVisitNo >= 0) {
    const next = [...list];
    next[byVisitNo] = {...next[byVisitNo], ...record, id: next[byVisitNo].id};
    return next;
  }
  const byId = list.findIndex(item => item.id === record.id);
  if (byId >= 0) {
    const next = [...list];
    next[byId] = record;
    return next;
  }
  return [record, ...list];
}

function upsertReport(
  list: HealthReportListItem[],
  record: HealthReportListItem,
): HealthReportListItem[] {
  const byVoucher = list.findIndex(item => item.voucher_no === record.voucher_no);
  if (byVoucher >= 0) {
    const next = [...list];
    next[byVoucher] = {...next[byVoucher], ...record, id: next[byVoucher].id};
    return next;
  }
  const byId = list.findIndex(item => item.id === record.id);
  if (byId >= 0) {
    const next = [...list];
    next[byId] = record;
    return next;
  }
  return [record, ...list];
}

function recordFromOcr(result: OcrResult): ArchiveRecord | null {
  if (!result.id) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: result.id,
    diagnosis: result.diagnosis || '',
    medicine: result.medicine || '',
    visit_date: (result.visit_date || '').slice(0, 10),
    visit_no: result.visit_no || '',
    raw_ocr_text: result.raw_ocr_text,
    created_at: now,
    updated_at: now,
  };
}

function reportFromOcr(result: OcrResult): HealthReportListItem | null {
  if (!result.id) {
    return null;
  }
  return {
    id: result.id,
    patient_name: result.patient_name || '',
    exam_date: (result.visit_date || '').slice(0, 10),
    org_name: result.org_name || '',
    voucher_no: result.voucher_no || result.visit_no || '',
    report_type: result.report_type || text('zh', 'healthArchiveReport'),
  };
}

function isDuplicateArchiveError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.status === 409 ||
      err.code === 'visit_no_conflict' ||
      err.code === 'voucher_no_conflict')
  );
}

function isOcrBannerError(message: string): boolean {
  return [
    'ocrSoon',
    'ocrAlreadyInArchive',
    'ocrFailed',
    'ocrPickFailed',
    'ocrCameraDenied',
    'ocrImageTooLarge',
  ].some(key => message === text('zh', key));
}

function messageForOcrError(err: unknown): string {
  if (isDuplicateArchiveError(err)) {
    return text('zh', 'ocrAlreadyInArchive');
  }
  if (err instanceof ApiError) {
    if (err.code === 'image_too_large') {
      return text('zh', 'ocrImageTooLarge');
    }
    return err.message || text('zh', 'ocrFailed');
  }
  if (err instanceof Error) {
    if (err.name === 'NotAllowedError') {
      return text('zh', 'ocrCameraDenied');
    }
    if (err.name === 'ImageTooLarge') {
      return text('zh', 'ocrImageTooLarge');
    }
    return err.message || text('zh', 'ocrPickFailed');
  }
  return text('zh', 'ocrFailed');
}

function recordFromDraft(id: string, draft: OcrDraft): ArchiveRecord {
  const now = new Date().toISOString();
  return {
    id,
    diagnosis: draft.diagnosis.trim(),
    medicine: draft.medicine.trim(),
    visit_date: draft.visit_date.trim().slice(0, 10),
    visit_no: draft.visit_no.trim(),
    raw_ocr_text: draft.raw_ocr_text,
    created_at: now,
    updated_at: now,
  };
}

type LatestEvent =
  | {kind: 'report'; item: HealthReportListItem}
  | {kind: 'visit'; item: ArchiveRecord};

function pickLatestEvent(
  reports: HealthReportListItem[],
  visits: ArchiveRecord[],
): LatestEvent | null {
  const latestReport = reports.reduce<HealthReportListItem | null>((best, item) => {
    if (!best || formatDate(item.exam_date) > formatDate(best.exam_date)) {
      return item;
    }
    return best;
  }, null);
  const latestVisit = visits.reduce<ArchiveRecord | null>((best, item) => {
    if (!best || formatDate(item.visit_date) > formatDate(best.visit_date)) {
      return item;
    }
    return best;
  }, null);

  if (!latestReport && !latestVisit) {
    return null;
  }
  if (!latestReport && latestVisit) {
    return {kind: 'visit', item: latestVisit};
  }
  if (latestReport && !latestVisit) {
    return {kind: 'report', item: latestReport};
  }
  return formatDate(latestVisit!.visit_date) >= formatDate(latestReport!.exam_date)
    ? {kind: 'visit', item: latestVisit!}
    : {kind: 'report', item: latestReport!};
}

type HomeSummaryCard = {
  id: string;
  title: string;
  dateLabel: string;
  date: string | null;
  noLabel: string;
  no: string | null;
  body: string;
  items: Array<{id: string; content: string}>;
};

function visitToHomeCard(visit: ArchiveRecord): HomeSummaryCard {
  return {
    id: `recent-visit:${visit.id}`,
    title: text('zh', 'recentVisitTitle'),
    dateLabel: text('zh', 'visitDateLabel'),
    date: visit.visit_date,
    noLabel: text('zh', 'visitNoLabel'),
    no: visit.visit_no,
    body: visit.diagnosis,
    items: visit.medicine
      ? [{id: `${visit.id}-med`, content: `${text('zh', 'medicineLabel')}：${visit.medicine}`}]
      : [],
  };
}

function reportToHomeCard(report: HealthReportListItem): HomeSummaryCard {
  return {
    id: `recent-report:${report.id}`,
    title: text('zh', 'recentCheckupTitle'),
    dateLabel: text('zh', 'examDateLabel'),
    date: report.exam_date,
    noLabel: text('zh', 'examNoLabel'),
    no: report.voucher_no,
    body: `${report.org_name} · ${report.report_type}`,
    items: [],
  };
}

function summaryToHomeCard(summary: HealthSummary, asCheckup: boolean): HomeSummaryCard {
  return {
    id: summary.id,
    title: summary.title || (asCheckup ? text('zh', 'recentCheckupTitle') : text('zh', 'healthProblemTitle')),
    dateLabel: text('zh', 'examDateLabel'),
    date: summary.exam_date,
    noLabel: text('zh', 'examNoLabel'),
    no: summary.exam_no,
    body: summary.summary_text,
    items: (summary.items || []).map(item => ({id: item.id, content: item.content})),
  };
}

function matchCheckupSummary(
  summaries: HealthSummary[],
  report: HealthReportListItem,
): HealthSummary | null {
  const sameExam = summaries.filter(item => {
    const sameNo = Boolean(item.exam_no && item.exam_no === report.voucher_no);
    const sameDate =
      Boolean(item.exam_date) && formatDate(item.exam_date) === formatDate(report.exam_date);
    return sameNo || sameDate;
  });
  if (!sameExam.length) {
    return null;
  }
  const named = sameExam.find(item => item.title.includes('体检') && !(item.items?.length));
  if (named) {
    return named;
  }
  const plain = sameExam.find(item => !(item.items?.length));
  return plain || sameExam[0];
}

function buildRecentHomeCard(
  reports: HealthReportListItem[],
  visits: ArchiveRecord[],
  summaries: HealthSummary[],
): {card: HomeSummaryCard | null; usedSummaryId: string | null} {
  const latest = pickLatestEvent(reports, visits);
  if (!latest) {
    return {card: null, usedSummaryId: null};
  }
  if (latest.kind === 'visit') {
    return {card: visitToHomeCard(latest.item), usedSummaryId: null};
  }
  const matched = matchCheckupSummary(summaries, latest.item);
  if (matched) {
    return {card: summaryToHomeCard(matched, true), usedSummaryId: matched.id};
  }
  return {card: reportToHomeCard(latest.item), usedSummaryId: null};
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
  document_type: 'visit',
  id: 'a1',
  diagnosis: '支气管炎倾向，建议复查',
  medicine: '按医嘱服用止咳药，注意饮水',
  visit_date: '2026-07-27',
  visit_no: 'MZ202607270018',
  raw_ocr_text: '演示 OCR 全文：门诊病历……就诊号 MZ202607270018……',
  findings: [],
};

const DEMO_ARCHIVES: ArchiveRecord[] = [
  {
    id: 'a1',
    diagnosis: '支气管炎倾向，建议复查',
    medicine: '按医嘱服用止咳药，注意饮水',
    visit_date: '2026-07-27',
    visit_no: 'MZ202607270018',
    raw_ocr_text: '门诊病历：主诉咳嗽胸闷……就诊号 MZ202607270018。诊断：支气管炎倾向。',
    created_at: '2026-07-27T00:00:00Z',
    updated_at: '2026-07-27T00:00:00Z',
  },
];

export default function ArchiveScreen() {
  const [mode, setMode] = useState<ViewMode>('home');
  const [summaries, setSummaries] = useState<HealthSummary[]>([]);
  const [reports, setReports] = useState<HealthReportListItem[]>([]);
  const [visits, setVisits] = useState<ArchiveRecord[]>([]);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [reportDetail, setReportDetail] = useState<HealthReportDetail | null>(null);
  const [visitDetail, setVisitDetail] = useState<ArchiveRecord | null>(null);
  const [detailTab, setDetailTab] = useState<'abnormal' | 'full'>('abnormal');

  const [homeLoading, setHomeLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoMode, setDemoMode] = useState(false);

  const [recognizing, setRecognizing] = useState(false);
  const [ocrDraft, setOcrDraft] = useState<OcrDraft>(emptyDraft());
  const [recognizeSource, setRecognizeSource] = useState<'camera' | 'album' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedArchiveId, setSavedArchiveId] = useState<string | null>(null);
  const [hasCachedOcr, setHasCachedOcr] = useState(false);
  const [openedFromCache, setOpenedFromCache] = useState(false);
  const recognizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCachedFlag = useCallback(() => {
    setHasCachedOcr(Boolean(loadLastOcrCache(cacheUserKey())));
  }, []);

  const persistOcrDraft = useCallback(
    (
      draft: OcrDraft,
      source: 'camera' | 'album' | null,
      extras?: {
        saved?: boolean;
        savedArchiveId?: string | null;
        /** 仅新识别成功时传入，用于覆盖缓存 */
        recognizedAt?: string;
      },
    ) => {
      if (!isDraftFilled(draft)) {
        refreshCachedFlag();
        return;
      }
      saveLastOcrCache({
        userKey: cacheUserKey(),
        draft,
        source,
        saved: extras?.saved,
        savedArchiveId: extras?.savedArchiveId,
        recognizedAt: extras?.recognizedAt,
      });
      setHasCachedOcr(true);
    },
    [refreshCachedFlag],
  );

  useEffect(() => {
    refreshCachedFlag();
    return () => {
      if (recognizeTimerRef.current) {
        clearTimeout(recognizeTimerRef.current);
      }
    };
  }, [refreshCachedFlag]);

  // 切换账号后按当前用户标识重新加载对应缓存
  useEffect(() => {
    refreshCachedFlag();
  }, [refreshCachedFlag, mode]);

  const loadHome = useCallback(async () => {
    const token = getAccessToken();
    if (isDemoToken(token)) {
      setDemoMode(true);
      setSummaries(DEMO_SUMMARIES);
      setReports(DEMO_REPORTS);
      setVisits(prev => (prev.length ? prev : DEMO_ARCHIVES));
      setHomeLoading(false);
      setError('');
      return;
    }

    setDemoMode(false);
    setHomeLoading(true);
    setError('');
    try {
      const [summaryResult, reportResult, archiveResult] = await Promise.allSettled([
        listHealthSummaries(token!),
        listHealthReports(token!, {page: 1, page_size: 100}),
        listArchives(token!, {page: 1, page_size: 100}),
      ]);
      const summaryItems =
        summaryResult.status === 'fulfilled' ? summaryResult.value.items || [] : [];
      const reportItems =
        reportResult.status === 'fulfilled' ? reportResult.value.items || [] : [];
      const visitItems =
        archiveResult.status === 'fulfilled' ? archiveResult.value.items || [] : [];
      setSummaries(summaryItems);
      setReports(reportItems);
      if (archiveResult.status === 'fulfilled') {
        setVisits(visitItems);
      }
      if (
        summaryResult.status === 'rejected' &&
        reportResult.status === 'rejected' &&
        archiveResult.status === 'rejected'
      ) {
        const err = summaryResult.reason;
        setError(err instanceof ApiError ? err.message : text('zh', 'archiveLoadFailed'));
      }
    } catch (err) {
      setSummaries([]);
      setReports([]);
      setVisits([]);
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
      setVisits(prev => (prev.length ? prev : DEMO_ARCHIVES));
      setReportsLoading(false);
      setError('');
      return;
    }

    setDemoMode(false);
    setReportsLoading(true);
    setError('');
    try {
      const [reportResult, archiveResult] = await Promise.allSettled([
        listHealthReports(token!, {page: 1, page_size: 100}),
        listArchives(token!, {page: 1, page_size: 100}),
      ]);
      const reportItems =
        reportResult.status === 'fulfilled' ? reportResult.value.items || [] : [];
      const visitItems =
        archiveResult.status === 'fulfilled' ? archiveResult.value.items || [] : [];
      setReports(reportItems);
      if (archiveResult.status === 'fulfilled') {
        setVisits(visitItems);
      }
      if (reportResult.status === 'rejected' && archiveResult.status === 'rejected') {
        const err = reportResult.reason;
        setError(err instanceof ApiError ? err.message : text('zh', 'archiveLoadFailed'));
      }
    } catch (err) {
      setReports([]);
      setVisits([]);
      setError(err instanceof ApiError ? err.message : text('zh', 'archiveLoadFailed'));
    } finally {
      setReportsLoading(false);
    }
  }, []);

  const loadTimelineDetail = useCallback(async (item: SelectedItem) => {
    const token = getAccessToken();
    if (isDemoToken(token)) {
      setDemoMode(true);
      if (item.kind === 'report') {
        const detail = DEMO_REPORT_DETAILS[item.id] || null;
        setReportDetail(detail);
        setVisitDetail(null);
        setDetailLoading(false);
        setError(detail ? '' : text('zh', 'archiveEmptyDetail'));
        return;
      }
      const visit =
        visits.find(row => row.id === item.id) ||
        DEMO_ARCHIVES.find(row => row.id === item.id) ||
        null;
      setVisitDetail(visit);
      setReportDetail(null);
      setDetailLoading(false);
      setError(visit ? '' : text('zh', 'archiveEmptyDetail'));
      return;
    }

    setDemoMode(false);
    setDetailLoading(true);
    setError('');
    try {
      if (item.kind === 'report') {
        const detail = await getHealthReport(token!, item.id);
        setReportDetail(detail);
        setVisitDetail(null);
      } else {
        const detail = await getArchive(token!, item.id);
        setVisitDetail(detail);
        setReportDetail(null);
      }
    } catch (err) {
      setReportDetail(null);
      setVisitDetail(null);
      setError(err instanceof ApiError ? err.message : text('zh', 'archiveLoadFailed'));
    } finally {
      setDetailLoading(false);
    }
  }, [visits]);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  useEffect(() => {
    if (mode === 'reports') {
      loadReports();
    }
  }, [mode, loadReports]);

  useEffect(() => {
    if (mode === 'detail' && selectedItem) {
      loadTimelineDetail(selectedItem);
    }
  }, [mode, selectedItem, loadTimelineDetail]);

  function leaveConfirmToHome() {
    if (recognizeTimerRef.current) {
      clearTimeout(recognizeTimerRef.current);
      recognizeTimerRef.current = null;
    }
    // 返回不清除缓存：未保存/未推送也保留，直到下次新识别覆盖
    setRecognizing(false);
    setSaving(false);
    setError('');
    setOpenedFromCache(false);
    setOcrDraft(emptyDraft());
    setRecognizeSource(null);
    setSaved(false);
    setSavedArchiveId(null);
    refreshCachedFlag();
    setMode('home');
  }

  function openLastOcrCache() {
    const cached = loadLastOcrCache(cacheUserKey());
    if (!cached) {
      setHasCachedOcr(false);
      return;
    }
    setError('');
    setOcrDraft({
      ...emptyDraft(),
      ...cached.draft,
      document_type: cached.draft.document_type === 'exam' ? 'exam' : 'visit',
      patient_name: cached.draft.patient_name || '',
      org_name: cached.draft.org_name || '',
      voucher_no: cached.draft.voucher_no || '',
      report_type: cached.draft.report_type || '',
    });
    setRecognizeSource(cached.source);
    setSaved(cached.saved);
    setSavedArchiveId(cached.savedArchiveId);
    setRecognizing(false);
    setOpenedFromCache(true);
    setMode('confirm');
  }

  function updateDraft(patch: Partial<OcrDraft>) {
    setOcrDraft(prev => {
      const next = {...prev, ...patch};
      persistOcrDraft(next, recognizeSource, {
        saved,
        savedArchiveId,
      });
      return next;
    });
    setOpenedFromCache(false);
  }

  /** 演示：模拟识别。正式登录：选图后只调 POST /archives/ocr，后端已入库。 */
  function startDemoRecognize(source: 'camera' | 'album') {
    if (recognizeTimerRef.current) {
      clearTimeout(recognizeTimerRef.current);
    }

    setError('');
    setSaved(false);
    setSavedArchiveId(null);
    setRecognizeSource(source);
    setRecognizing(true);
    setOpenedFromCache(false);
    setMode('confirm');
    setOcrDraft(emptyDraft());

    recognizeTimerRef.current = setTimeout(() => {
      const nextDraft = draftFromOcr(DEMO_OCR_RESULT);
      setOcrDraft(nextDraft);
      setRecognizing(false);
      persistOcrDraft(nextDraft, source, {
        saved: false,
        savedArchiveId: null,
        recognizedAt: new Date().toISOString(),
      });
      recognizeTimerRef.current = null;
    }, 700);
  }

  async function startRecognize(source: 'camera' | 'album') {
    const token = getAccessToken();
    if (isDemoToken(token)) {
      startDemoRecognize(source);
      return;
    }

    setError('');
    let picked;
    try {
      picked = await pickImage(source);
    } catch (err) {
      if (isImagePickCancelled(err)) {
        return;
      }
      setError(messageForOcrError(err));
      return;
    }

    if (recognizeTimerRef.current) {
      clearTimeout(recognizeTimerRef.current);
      recognizeTimerRef.current = null;
    }

    setSaved(false);
    setSavedArchiveId(null);
    setRecognizeSource(source);
    setRecognizing(true);
    setOpenedFromCache(false);
    setOcrDraft(emptyDraft());
    setMode('confirm');

    try {
      const result = await ocrArchiveImage(token!, {
        file: picked.file,
        source,
        fileName: picked.name,
      });
      const nextDraft = draftFromOcr(result);
      const savedId = result.id || null;
      setOcrDraft(nextDraft);
      setRecognizing(false);
      setSaved(true);
      setSavedArchiveId(savedId);
      persistOcrDraft(nextDraft, source, {
        saved: true,
        savedArchiveId: savedId,
        recognizedAt: new Date().toISOString(),
      });
      if (result.document_type === 'exam') {
        const report = reportFromOcr(result);
        if (report) {
          setReports(prev => upsertReport(prev, report));
        }
      } else {
        const visit = recordFromOcr(result);
        if (visit) {
          setVisits(prev => upsertVisit(prev, visit));
        }
      }
      loadHome().catch(() => undefined);
    } catch (err) {
      setRecognizing(false);
      setMode('home');
      setError(messageForOcrError(err));
      if (isDuplicateArchiveError(err)) {
        loadHome().catch(() => undefined);
      }
    }
  }

  function openOcrDetail() {
    if (!savedArchiveId) {
      return;
    }
    setSelectedItem({
      kind: ocrDraft.document_type === 'exam' ? 'report' : 'visit',
      id: savedArchiveId,
    });
    setDetailTab('abnormal');
    setReportDetail(null);
    setVisitDetail(null);
    setMode('detail');
  }

  async function handleSaveArchive() {
    if (saving || recognizing || saved) {
      return;
    }
    const diagnosis = ocrDraft.diagnosis.trim();
    const medicine = ocrDraft.medicine.trim();
    const visitDate = ocrDraft.visit_date.trim();
    const visitNo = ocrDraft.visit_no.trim();
    if (!visitNo) {
      setError(text('zh', 'visitNoRequired'));
      return;
    }
    if (!diagnosis || !medicine || !visitDate) {
      setError(text('zh', 'archiveSaveFailed'));
      return;
    }

    const token = getAccessToken();
    if (isDemoToken(token)) {
      const record = recordFromDraft(`demo-${visitNo}`, ocrDraft);
      setVisits(prev => upsertVisit(prev.length ? prev : DEMO_ARCHIVES, record));
      setSaved(true);
      setSavedArchiveId(record.id);
      setError('');
      persistOcrDraft(ocrDraft, recognizeSource, {
        saved: true,
        savedArchiveId: record.id,
      });
      return;
    }

    // 正式登录：OCR 接口已入库，确认页不再 POST /archives
    setSaved(true);
    setError('');
    persistOcrDraft(ocrDraft, recognizeSource, {
      saved: true,
      savedArchiveId,
    });
  }

  const {card: recentFromTimeline, usedSummaryId} = buildRecentHomeCard(
    reports,
    visits,
    summaries,
  );
  const recentCard =
    recentFromTimeline ||
    (summaries[0]
      ? summaryToHomeCard(
          summaries.find(item => (item.items?.length || 0) > 0) || summaries[0],
          false,
        )
      : null);
  const recentId = recentFromTimeline ? usedSummaryId : recentCard?.id || null;
  const problemSummary =
    summaries.find(item => item.id !== recentId && (item.items?.length || 0) > 0) || null;
  const otherSummaries = summaries.filter(
    item => item.id !== recentId && item.id !== problemSummary?.id,
  );

  const glossaryFallback: ReportGlossaryItem[] = [
    {id: 'g1', term: '随诊', definition: text('zh', 'glossaryFollow'), sort_order: 0},
    {id: 'g2', term: '诊治', definition: text('zh', 'glossaryTreat'), sort_order: 1},
    {id: 'g3', term: '复查', definition: text('zh', 'glossaryRecheck'), sort_order: 2},
  ];

  if (mode === 'confirm') {
    const isDemo = isDemoToken(getAccessToken());
    const sourceLabel =
      recognizeSource === 'camera'
        ? text('zh', 'cameraImport')
        : recognizeSource === 'album'
          ? text('zh', 'albumImport')
          : text('zh', 'ocrResultTitle');

    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <BackButton label={text('zh', 'backToArchive')} onPress={leaveConfirmToHome} />
        <Text style={styles.title}>{text('zh', 'ocrConfirmTitle')}</Text>
        <Text style={styles.subtitle}>
          {isDemo ? text('zh', 'ocrConfirmSubtitle') : text('zh', 'ocrConfirmLiveSubtitle')}
        </Text>
        <Text style={styles.confirmSource}>
          {sourceLabel}
          {openedFromCache ? ` · ${text('zh', 'ocrCachedBadge')}` : ''}
        </Text>

        {recognizing ? (
          <LoadingBlock label={text('zh', 'ocrRecognizing')} />
        ) : saved ? (
          <View style={styles.resultCard}>
            <Text style={styles.cardTitle}>{text('zh', 'ocrResultTitle')}</Text>
            {ocrDraft.document_type === 'exam' ? (
              <>
                <InfoRow label={text('zh', 'patientNameLabel')} value={ocrDraft.patient_name} />
                <InfoRow label={text('zh', 'orgNameLabel')} value={ocrDraft.org_name} />
                <InfoRow
                  label={text('zh', 'examVoucherLabel')}
                  value={ocrDraft.voucher_no || ocrDraft.visit_no}
                />
                <InfoRow label={text('zh', 'examDateLabel')} value={formatDate(ocrDraft.visit_date)} />
                {ocrDraft.diagnosis ? (
                  <InfoRow label={text('zh', 'diagnosisLabel')} value={ocrDraft.diagnosis} />
                ) : null}
                {ocrDraft.medicine ? (
                  <InfoRow label={text('zh', 'medicineLabel')} value={ocrDraft.medicine} />
                ) : null}
              </>
            ) : (
              <>
                <InfoRow label={text('zh', 'visitNoLabel')} value={ocrDraft.visit_no} />
                <InfoRow label={text('zh', 'diagnosisLabel')} value={ocrDraft.diagnosis} />
                <InfoRow label={text('zh', 'medicineLabel')} value={ocrDraft.medicine} />
                <InfoRow label={text('zh', 'dateLabel')} value={formatDate(ocrDraft.visit_date)} />
              </>
            )}
            <Text style={styles.savedText}>
              {isDemo ? text('zh', 'savedStatus') : text('zh', 'ocrSavedAuto')}
            </Text>
            {ocrDraft.document_type === 'visit' ? (
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={!savedArchiveId}
                  onPress={() => {
                    if (isDemo) {
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
                    if (isDemo) {
                      setError('');
                      return;
                    }
                    setError(text('zh', 'exportSoon'));
                  }}
                  style={styles.secondaryButtonWide}>
                  <Text style={styles.secondaryText}>{text('zh', 'exportPdf')}</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={!savedArchiveId}
              onPress={openOcrDetail}
              style={[styles.primaryButtonFull, !savedArchiveId && styles.disabledButton]}>
              <Text style={styles.primaryText}>{text('zh', 'ocrViewDetail')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={leaveConfirmToHome}
              style={styles.cancelButton}>
              <Text style={styles.cancelText}>{text('zh', 'ocrDoneBack')}</Text>
            </Pressable>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        ) : (
          <View style={styles.confirmCard}>
            <Text style={styles.cardTitle}>{text('zh', 'ocrResultTitle')}</Text>
            <Text style={styles.fieldLabel}>{text('zh', 'visitNoLabel')}</Text>
            <TextInput
              accessibilityLabel={text('zh', 'visitNoLabel')}
              value={ocrDraft.visit_no}
              onChangeText={value => updateDraft({visit_no: value})}
              placeholder={text('zh', 'visitNoPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              style={styles.fieldInput}
            />
            <Text style={styles.fieldLabel}>{text('zh', 'diagnosisLabel')}</Text>
            <TextInput
              accessibilityLabel={text('zh', 'diagnosisLabel')}
              value={ocrDraft.diagnosis}
              onChangeText={value => updateDraft({diagnosis: value})}
              placeholder={text('zh', 'diagnosisPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              style={[styles.fieldInput, styles.fieldInputTall]}
            />
            <Text style={styles.fieldLabel}>{text('zh', 'medicineLabel')}</Text>
            <TextInput
              accessibilityLabel={text('zh', 'medicineLabel')}
              value={ocrDraft.medicine}
              onChangeText={value => updateDraft({medicine: value})}
              placeholder={text('zh', 'medicinePlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              style={[styles.fieldInput, styles.fieldInputTall]}
            />
            <Text style={styles.fieldLabel}>{text('zh', 'dateLabel')}</Text>
            <TextInput
              accessibilityLabel={text('zh', 'dateLabel')}
              value={ocrDraft.visit_date}
              onChangeText={value => updateDraft({visit_date: value})}
              placeholder={text('zh', 'datePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.fieldInput}
            />
            {ocrDraft.raw_ocr_text ? (
              <View style={styles.rawBox}>
                <Text style={styles.fieldLabel}>{text('zh', 'ocrRawLabel')}</Text>
                <Text style={styles.rawText}>{ocrDraft.raw_ocr_text}</Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={handleSaveArchive}
              style={[styles.primaryButtonFull, saving && styles.disabledButton]}>
              {saving ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryText}>{text('zh', 'saveRecord')}</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={leaveConfirmToHome}
              style={styles.cancelButton}>
              <Text style={styles.cancelText}>{text('zh', 'ocrCancel')}</Text>
            </Pressable>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        )}
      </ScrollView>
    );
  }

  if (mode === 'detail') {
    const isVisit = selectedItem?.kind === 'visit';
    const findings = reportDetail?.findings || [];
    const glossary =
      reportDetail?.glossary && reportDetail.glossary.length > 0
        ? reportDetail.glossary
        : glossaryFallback;
    const visitFindings = visitDetail
      ? [
          {
            id: 'visit-diagnosis',
            title: `${text('zh', 'diagnosisLabel')}：${visitDetail.diagnosis}`,
            suggestion: `${text('zh', 'medicineLabel')}：${visitDetail.medicine}`,
          },
        ]
      : [];
    const detailCards = isVisit ? visitFindings : findings;
    const hasDetail = isVisit ? Boolean(visitDetail) : Boolean(reportDetail);
    const detailName = isVisit ? visitDetail?.diagnosis : reportDetail?.patient_name;
    const detailNoLabel = isVisit ? text('zh', 'visitNoLabel') : text('zh', 'examNoLabel');
    const detailNo = isVisit ? visitDetail?.visit_no : reportDetail?.voucher_no;
    const detailDate = isVisit ? visitDetail?.visit_date : reportDetail?.exam_date;
    const fullText = isVisit
      ? visitDetail?.raw_ocr_text?.trim()
      : reportDetail?.full_text?.trim();
    const primaryTabLabel = isVisit ? text('zh', 'visitInfoTab') : text('zh', 'abnormalTab');

    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackButton
          label={text('zh', 'backToReports')}
          onPress={() => {
            setMode('reports');
            setSelectedItem(null);
            setReportDetail(null);
            setVisitDetail(null);
          }}
        />

        {detailLoading ? (
          <LoadingBlock label={text('zh', 'archiveLoading')} />
        ) : hasDetail ? (
          <>
            <Text style={styles.detailName}>{detailName}</Text>
            <Text style={styles.metaLine}>
              {detailNoLabel}：{detailNo}
            </Text>
            <Text style={styles.metaLine}>
              {text('zh', 'examDateLabel')}：{formatDate(detailDate)}
            </Text>

            <View style={styles.detailTabs}>
              <Pressable
                accessibilityRole="tab"
                onPress={() => setDetailTab('abnormal')}
                style={[styles.detailTab, detailTab === 'abnormal' && styles.detailTabActive]}>
                <Text style={[styles.detailTabText, detailTab === 'abnormal' && styles.detailTabTextActive]}>
                  {primaryTabLabel}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{detailCards.length}项</Text>
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
              detailCards.length ? (
                detailCards.map(item => (
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
                <Text style={styles.fullText}>{fullText || text('zh', 'fullReportBody')}</Text>
              </View>
            )}

            {isVisit ? null : (
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
            )}
          </>
        ) : (
          <EmptyBlock label={error || text('zh', 'archiveEmptyDetail')} />
        )}

        {error && hasDetail ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    );
  }

  if (mode === 'reports') {
    const timeline = mergeTimeline(reports, visits);
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackButton label={text('zh', 'backToArchive')} onPress={() => setMode('home')} />
        <Text style={styles.title}>{text('zh', 'healthArchiveReport')}</Text>
        <Text style={styles.subtitle}>{text('zh', 'reportListSubtitle')}</Text>

        {reportsLoading ? (
          <LoadingBlock label={text('zh', 'archiveLoading')} />
        ) : error && !timeline.length ? (
          <EmptyBlock label={error} onRetry={loadReports} />
        ) : !timeline.length ? (
          <EmptyBlock label={text('zh', 'archiveEmptyReports')} onRetry={loadReports} />
        ) : (
          <View style={styles.reportList}>
            {timeline.map((item, index) => {
              const isLast = index === timeline.length - 1;
              return (
                <View key={item.key} style={styles.reportItem}>
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
                    <Text style={styles.reportDate}>{formatDate(item.date)}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.date} ${item.badge}`}
                      onPress={() => {
                        setSelectedItem({kind: item.kind, id: item.id});
                        setDetailTab('abnormal');
                        setReportDetail(null);
                        setVisitDetail(null);
                        setMode('detail');
                      }}
                      style={styles.reportCard}>
                      <View style={styles.reportBadge}>
                        <Text style={styles.reportBadgeText}>{item.badge}</Text>
                      </View>
                      <Text style={styles.reportName}>{item.title}</Text>
                      <View style={styles.reportOrgRow}>
                        <View style={styles.orgIcon} />
                        <Text style={styles.reportOrg}>{item.subtitle}</Text>
                      </View>
                      <Text style={styles.reportVoucher}>
                        {item.voucherLabel}：{item.voucherNo}
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
        {hasCachedOcr ? (
          <View style={styles.cacheBox}>
            <Text style={styles.cacheHint}>{text('zh', 'ocrLastResultHint')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={openLastOcrCache}
              style={styles.cacheButton}>
              <Text style={styles.cacheButtonText}>{text('zh', 'ocrLastResult')}</Text>
            </Pressable>
          </View>
        ) : null}
        {error && !homeLoading ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {homeLoading ? (
        <LoadingBlock label={text('zh', 'archiveLoading')} />
      ) : (
        <>
          {error &&
          !recentCard &&
          !problemSummary &&
          !otherSummaries.length &&
          error !== text('zh', 'ocrSoon') &&
          !isOcrBannerError(error) ? (
            <EmptyBlock label={error} onRetry={loadHome} />
          ) : null}

          {recentCard ? <SummaryCard card={recentCard} /> : null}

          {problemSummary ? (
            <SummaryCard card={summaryToHomeCard(problemSummary, false)} />
          ) : null}

          {otherSummaries.map(item => (
            <SummaryCard key={item.id} card={summaryToHomeCard(item, false)} />
          ))}

          {!recentCard && !problemSummary && !otherSummaries.length && !error ? (
            <EmptyBlock label={text('zh', 'archiveEmptySummaries')} onRetry={loadHome} />
          ) : null}
        </>
      )}

      {error && summaries.length && error !== text('zh', 'ocrSoon') && !isOcrBannerError(error) ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => setMode('reports')}
        style={styles.reportButton}>
        <Text style={styles.reportButtonText}>{text('zh', 'healthArchiveReport')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function SummaryCard({card}: {card: HomeSummaryCard}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.metaLine}>
        {card.dateLabel}：{formatDate(card.date)}
      </Text>
      <Text style={styles.metaLine}>
        {card.noLabel}：{card.no || '—'}
      </Text>
      {card.body ? <Text style={styles.summaryBody}>{card.body}</Text> : null}
      {card.items.map(issue => (
        <View key={issue.id} style={styles.issueRow}>
          <View style={styles.issueDot} />
          <Text style={styles.issueText}>{issue.content}</Text>
        </View>
      ))}
    </View>
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
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  confirmSource: {
    ...typography.label,
    color: colors.primary,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
  },
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
    paddingVertical: spacing.md,
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  fieldInputTall: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  rawBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceBlue,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  rawText: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  cancelButton: {
    minHeight: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  cancelText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  cacheBox: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderNeutral,
  },
  cacheHint: {
    ...typography.bodyLarge,
    color: colors.textMuted,
  },
  cacheButton: {
    marginTop: spacing.sm,
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cacheButtonText: {
    ...typography.bodyStrong,
    color: colors.primary,
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
