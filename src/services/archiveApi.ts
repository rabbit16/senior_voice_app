import {env} from '../config/env';
import {apiRequest} from './http';

// ---------------------------------------------------------------------------
// 就诊单档案（OCR）→ 表 medical_archives / archive_ocr_jobs
// ---------------------------------------------------------------------------

export type ArchiveRecord = {
  id: string;
  diagnosis: string;
  medicine: string;
  visit_date: string;
  /** 就诊号 / 门诊号，用户维度业务唯一标识 */
  visit_no: string;
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

export type OcrDocumentType = 'visit' | 'exam';

export type OcrFinding = {
  title: string;
  suggestion: string;
  risk_level?: 'low' | 'medium' | 'high' | null;
  sort_order: number;
};

/**
 * POST /archives/ocr 响应。后端已按类型入库：
 * visit → medical_archives；exam → health_reports。
 * 不要再用同一张单去 POST /archives。
 */
export type OcrResult = {
  document_type: OcrDocumentType;
  /** 已落库 id；就诊单 archive id / 体检单 report id */
  id?: string | null;
  diagnosis: string;
  medicine: string;
  visit_date: string;
  visit_no: string;
  raw_ocr_text: string;
  patient_name?: string | null;
  org_name?: string | null;
  voucher_no?: string | null;
  report_type?: string | null;
  findings?: OcrFinding[];
};

/** 识图比普通接口慢，单独加长超时（契约建议 ≥ 60s） */
const OCR_TIMEOUT_MS = Math.max(env.timeoutMs, 90000);

/** 上传病历图片做 OCR（后端分类并入库） */
export async function ocrArchiveImage(
  token: string,
  input: {
    file: Blob | {uri: string; type: string; name: string};
    source: 'camera' | 'album';
    fileName?: string;
  },
): Promise<OcrResult> {
  const formData = new FormData();
  const fileName = input.fileName || 'archive.jpg';
  if (typeof Blob !== 'undefined' && input.file instanceof Blob) {
    formData.append('file', input.file, fileName);
  } else {
    formData.append('file', input.file as unknown as Blob);
  }
  formData.append('source', input.source);

  return apiRequest({
    method: 'POST',
    path: '/archives/ocr',
    token,
    formData,
    timeoutMs: OCR_TIMEOUT_MS,
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
    visit_no: string;
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
  body: Partial<Pick<ArchiveRecord, 'diagnosis' | 'medicine' | 'visit_date' | 'visit_no'>>,
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
