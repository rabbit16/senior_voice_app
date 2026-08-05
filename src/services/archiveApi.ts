import {apiRequest} from './http';

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
  input: {file: {uri: string; type: string; name: string}; source: 'camera' | 'album'},
): Promise<OcrResult> {
  const formData = new FormData();
  formData.append('file', input.file as unknown as Blob);
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
