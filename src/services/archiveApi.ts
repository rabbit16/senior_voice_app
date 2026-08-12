import {apiRequest} from './http';

// ---------------------------------------------------------------------------
// 就诊单档案（OCR）→ 表 medical_archives / archive_ocr_jobs
// ---------------------------------------------------------------------------

export type ArchiveRecord = {
  id: string;
  diagnosis: string;
  medicine: string;
  visit_date: string;
  raw_ocr_text?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
};

export type ArchiveListResponse = {
  items: ArchiveRecord[];
  total: number;
  page: number;
  page_size: number;
};

export type OcrResult = {
  diagnosis: string;
  medicine: string;
  visit_date: string;
  raw_ocr_text: string;
};

/** 上传病历图片做 OCR */
export async function ocrArchiveImage(
  token: string,
  input: {file: Blob | {uri: string; type: string; name: string}; source: 'camera' | 'album'},
): Promise<OcrResult> {
  const formData = new FormData();
  if (typeof Blob !== 'undefined' && input.file instanceof Blob) {
    formData.append('file', input.file, 'archive.jpg');
  } else {
    formData.append('file', input.file as unknown as Blob);
  }
  formData.append('source', input.source);

  return apiRequest({
    method: 'POST',
    path: '/archives/ocr',
    token,
    formData,
  });
}

export async function listArchives(
  token: string,
  query?: {q?: string; page?: number; page_size?: number},
): Promise<ArchiveListResponse> {
  return apiRequest({
    method: 'GET',
    path: '/archives',
    token,
    query,
  });
}

export async function createArchive(
  token: string,
  body: {
    diagnosis: string;
    medicine: string;
    visit_date: string;
    raw_ocr_text?: string;
    image_url?: string;
  },
): Promise<ArchiveRecord> {
  return apiRequest({
    method: 'POST',
    path: '/archives',
    token,
    body,
  });
}

export async function getArchive(token: string, id: string): Promise<ArchiveRecord> {
  return apiRequest({
    method: 'GET',
    path: `/archives/${id}`,
    token,
  });
}

export async function updateArchive(
  token: string,
  id: string,
  body: Partial<Pick<ArchiveRecord, 'diagnosis' | 'medicine' | 'visit_date'>>,
): Promise<ArchiveRecord> {
  return apiRequest({
    method: 'PATCH',
    path: `/archives/${id}`,
    token,
    body,
  });
}

export async function deleteArchive(token: string, id: string): Promise<{ok: true}> {
  return apiRequest({
    method: 'DELETE',
    path: `/archives/${id}`,
    token,
  });
}

export async function shareArchive(
  token: string,
  id: string,
  body: {contact_ids: string[]; message?: string},
): Promise<{ok: true; shared_count: number}> {
  return apiRequest({
    method: 'POST',
    path: `/archives/${id}/share`,
    token,
    body,
  });
}

export async function exportArchivePdf(
  token: string,
  id: string,
): Promise<{download_url: string; expires_in: number}> {
  return apiRequest({
    method: 'GET',
    path: `/archives/${id}/export`,
    token,
  });
}

// ---------------------------------------------------------------------------
// 健康问题总结 → 表 health_summaries + health_summary_items
// ---------------------------------------------------------------------------

export type HealthSummaryItem = {
  id: string;
  content: string;
  severity?: 'low' | 'medium' | 'high' | null;
  sort_order: number;
};

export type HealthSummary = {
  id: string;
  title: string;
  exam_date: string | null;
  exam_no: string | null;
  summary_text: string;
  items: HealthSummaryItem[];
  created_at: string;
  updated_at: string;
};

export type HealthSummaryListResponse = {
  items: HealthSummary[];
};

/** 档案首页：健康问题总结列表（含条目） */
export async function listHealthSummaries(token: string): Promise<HealthSummaryListResponse> {
  return apiRequest({
    method: 'GET',
    path: '/health-summaries',
    token,
  });
}

// ---------------------------------------------------------------------------
// 健康档案报告 → 表 health_reports + health_report_findings
// ---------------------------------------------------------------------------

export type HealthReportListItem = {
  id: string;
  patient_name: string;
  exam_date: string;
  org_name: string;
  voucher_no: string;
  report_type: string;
};

export type HealthReportListResponse = {
  items: HealthReportListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type HealthReportFinding = {
  id: string;
  title: string;
  suggestion: string;
  risk_level?: 'low' | 'medium' | 'high' | null;
  sort_order: number;
};

export type ReportGlossaryItem = {
  id: string;
  term: string;
  definition: string;
  sort_order: number;
};

export type HealthReportDetail = HealthReportListItem & {
  findings: HealthReportFinding[];
  /** 完整报告正文；无则前端展示占位 */
  full_text?: string | null;
  glossary?: ReportGlossaryItem[];
};

/** 报告时间轴列表 */
export async function listHealthReports(
  token: string,
  query?: {page?: number; page_size?: number},
): Promise<HealthReportListResponse> {
  return apiRequest({
    method: 'GET',
    path: '/health-reports',
    token,
    query,
  });
}

/** 报告详情（异常项 + 完整正文 + 术语） */
export async function getHealthReport(token: string, id: string): Promise<HealthReportDetail> {
  return apiRequest({
    method: 'GET',
    path: `/health-reports/${id}`,
    token,
  });
}

/** 全局术语释义（也可由报告详情内嵌 glossary） */
export async function listReportGlossaries(
  token: string,
): Promise<{items: ReportGlossaryItem[]}> {
  return apiRequest({
    method: 'GET',
    path: '/report-glossaries',
    token,
  });
}
