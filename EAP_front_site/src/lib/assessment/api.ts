import type {
  Assessment,
  AssessmentReportDetail,
  AssessmentReportPage,
  AssessmentSummary,
} from "@/lib/api/types";

type AssessmentCategory = "professional" | "fun";

interface ApiEnvelope<T> {
  code?: number;
  msg?: string;
  detail?: unknown;
  data?: T;
}

interface AssessmentDetailResponse {
  definition: Omit<Assessment, "questionCount">;
  questionCount: number;
  shareCode: string | null;
  shareUrl: string | null;
}

export class AssessmentApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "AssessmentApiError";
  }
}

function apiBaseUrl(): string {
  const configured =
    typeof window === "undefined"
      ? process.env.API_INTERNAL_BASE_URL?.trim() ||
        process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
        "http://localhost:8000"
      : process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";
  return configured.replace(/\/$/, "");
}

function errorMessage(payload: ApiEnvelope<unknown> | null, status: number): string {
  if (payload?.msg) return payload.msg;
  if (typeof payload?.detail === "string") return payload.detail;
  return `量表请求失败（${status}）`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | T | null;
  if (!response.ok) {
    throw new AssessmentApiError(
      errorMessage(payload as ApiEnvelope<unknown> | null, response.status),
      response.status
    );
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    const envelope = payload as ApiEnvelope<T>;
    if (typeof envelope.code === "number" && envelope.code !== 0) {
      throw new AssessmentApiError(errorMessage(envelope, envelope.code), envelope.code);
    }
    return envelope.data as T;
  }
  return payload as T;
}

function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listAssessments(
  category: AssessmentCategory
): Promise<AssessmentSummary[]> {
  return request<AssessmentSummary[]>(
    `/api/web/assessments?category=${encodeURIComponent(category)}`
  );
}

export async function getAssessment(
  id: string,
  category: AssessmentCategory
): Promise<Assessment | null> {
  try {
    const result = await request<AssessmentDetailResponse>(
      `/api/web/assessments/${encodeURIComponent(id)}`
    );
    if (result.definition.category !== category) return null;
    return {
      ...result.definition,
      questionCount: result.questionCount,
    } as Assessment;
  } catch (error) {
    if (error instanceof AssessmentApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export interface SubmitAssessmentReportInput {
  clientSubmissionId: string;
  assessmentId: string;
  assessmentVersion: number;
  demographicAnswers: Record<string, unknown>;
  answers: Record<string, string>;
  entrySource: "web" | "mini-webview" | "qr" | "direct";
  shareCode: string | null;
  consentVersion: string;
}

export function submitAssessmentReport(
  token: string,
  input: SubmitAssessmentReportInput
): Promise<AssessmentReportDetail> {
  return request<AssessmentReportDetail>("/api/web/assessment-reports", {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify(input),
  });
}

export interface ListAssessmentReportsOptions {
  page?: number;
  pageSize?: number;
  category?: AssessmentCategory;
  assessmentId?: string;
}

export function listAssessmentReports(
  token: string,
  options: ListAssessmentReportsOptions = {}
): Promise<AssessmentReportPage> {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    page_size: String(options.pageSize ?? 20),
  });
  if (options.category) params.set("category", options.category);
  if (options.assessmentId) params.set("assessment_id", options.assessmentId);
  return request<AssessmentReportPage>(
    `/api/web/assessment-reports?${params.toString()}`,
    { headers: bearer(token) }
  );
}

export function getAssessmentReport(
  token: string,
  publicId: string
): Promise<AssessmentReportDetail> {
  return request<AssessmentReportDetail>(
    `/api/web/assessment-reports/${encodeURIComponent(publicId)}`,
    { headers: bearer(token) }
  );
}

export function deleteAssessmentReport(
  token: string,
  publicId: string
): Promise<{ deleted: boolean; publicId: string }> {
  return request<{ deleted: boolean; publicId: string }>(
    `/api/web/assessment-reports/${encodeURIComponent(publicId)}`,
    { method: "DELETE", headers: bearer(token) }
  );
}
