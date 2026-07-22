import type { Assessment, AssessmentSummary } from "@/lib/api/types";

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

class AssessmentApiError extends Error {
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

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
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
