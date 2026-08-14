import type {
  CancelConsultationResult,
  ConsultationFeedbackPayload,
  ConsultationRecord,
  CounselorDetail,
  CounselorListResponse,
  PatientProfile,
  RefundExemptionPayload,
  SimulatePayResponse,
  TimeSlotsResponse,
} from "./types";
import { normalizeBookingTimeSlots } from "./slots";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000";

type ApiEnvelope<T> = { code?: number; msg?: string; data?: T };

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: HeadersInit = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers ?? {}),
  };
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const raw = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail =
      (raw as { detail?: string }).detail ??
      (raw as ApiEnvelope<T>).msg ??
      "请求失败";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  const body = raw as ApiEnvelope<T> & T;
  if (typeof body.code === "number" && body.code !== 0) {
    throw new Error(body.msg || "请求失败");
  }
  if (body && "data" in body && body.data !== undefined) {
    return body.data as T;
  }
  return body as T;
}

export async function fetchCounselors(params?: {
  keyword?: string;
  page?: number;
  page_size?: number;
}): Promise<CounselorListResponse> {
  const qs = new URLSearchParams();
  if (params?.keyword) qs.set("keyword", params.keyword);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  const query = qs.toString();
  return request<CounselorListResponse>(
    `/api/mini/common/counselors${query ? `?${query}` : ""}`
  );
}

export async function fetchCounselorDetail(
  id: number,
  source?: string | null
): Promise<CounselorDetail> {
  const qs = source ? `?source=${encodeURIComponent(source)}` : "";
  const data = await request<CounselorDetail>(`/api/mini/common/counselors/${id}${qs}`);
  return {
    ...data,
    timeSlots: normalizeBookingTimeSlots(data.timeSlots ?? []),
  };
}

export async function fetchCounselorTimeSlots(id: number): Promise<TimeSlotsResponse> {
  const data = await request<TimeSlotsResponse>(
    `/api/mini/common/counselors/${id}/time-slots`
  );
  return {
    ...data,
    timeSlots: normalizeBookingTimeSlots(data.timeSlots ?? []),
  };
}

export async function fetchPatientProfile(token: string): Promise<PatientProfile> {
  return request<PatientProfile>("/api/mini/patient/me", {}, token);
}

export async function fetchConsultations(
  token: string,
  status?: string
): Promise<ConsultationRecord[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<ConsultationRecord[]>(
    `/api/mini/patient/consultations${qs}`,
    {},
    token
  );
}

export async function cancelConsultation(
  token: string,
  consultationId: number
): Promise<CancelConsultationResult> {
  return request<CancelConsultationResult>(
    `/api/mini/patient/consultations/${consultationId}/cancel`,
    { method: "POST" },
    token
  );
}

export async function checkFavorite(token: string, counselorId: number): Promise<boolean> {
  const data = await request<{ favorited: boolean }>(
    `/api/mini/patient/favorites/check/${counselorId}`,
    {},
    token
  );
  return Boolean(data.favorited);
}

export async function addFavorite(token: string, counselorId: number): Promise<void> {
  await request(`/api/mini/patient/favorites/${counselorId}`, { method: "POST" }, token);
}

export async function removeFavorite(token: string, counselorId: number): Promise<void> {
  await request(`/api/mini/patient/favorites/${counselorId}`, { method: "DELETE" }, token);
}

export async function uploadSignature(token: string, blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "signature.png");
  const data = await request<{ url: string }>(
    "/api/upload/file",
    { method: "POST", body: form },
    token
  );
  if (!data.url) throw new Error("签名上传失败");
  return data.url;
}

export interface PayOrderPayload {
  slot_id: number;
  center_id: string;
  total_fee: number;
  description: string;
  is_adult?: boolean;
  signature_url?: string;
  real_name?: string;
  emergency_contact?: string;
  emergency_relation?: string;
  emergency_phone?: string;
}

export async function simulatePay(
  token: string,
  payload: PayOrderPayload
): Promise<SimulatePayResponse> {
  return request<SimulatePayResponse>(
    "/api/payment/wechat/simulate-pay",
    { method: "POST", body: JSON.stringify(payload) },
    token
  );
}

type RawMessage = {
  Id: number;
  AccountId: number;
  Type: string;
  Title: string;
  Content?: string | null;
  RelatedType?: string | null;
  RelatedId?: number | null;
  IsRead: boolean;
  CreatedAt: string;
  ReadAt?: string | null;
};

function normalizeMessage(raw: RawMessage) {
  return {
    id: raw.Id,
    accountId: raw.AccountId,
    type: raw.Type,
    title: raw.Title,
    content: raw.Content,
    relatedType: raw.RelatedType,
    relatedId: raw.RelatedId,
    isRead: raw.IsRead,
    createdAt: raw.CreatedAt,
    readAt: raw.ReadAt,
  };
}

export async function fetchMessages(
  token: string,
  params?: { category?: string; q?: string }
) {
  const qs = new URLSearchParams();
  if (params?.category && params.category !== "ALL") {
    if (params.category === "UNREAD") {
      qs.set("category", "UNREAD");
    } else {
      qs.set("category", params.category);
    }
  }
  if (params?.q) qs.set("q", params.q);
  const query = qs.toString();
  const rows = await request<RawMessage[]>(
    `/api/mini/message/list${query ? `?${query}` : ""}`,
    {},
    token
  );
  return rows.map(normalizeMessage);
}

export async function fetchUnreadMessageCount(token: string): Promise<number> {
  const data = await request<{ count: number }>(
    "/api/mini/message/unread-count",
    {},
    token
  );
  return data.count ?? 0;
}

export async function fetchMessageDetail(token: string, messageId: number) {
  const raw = await request<RawMessage>(
    `/api/mini/message/${messageId}`,
    {},
    token
  );
  return normalizeMessage(raw);
}

export async function markMessageRead(token: string, messageId: number) {
  const raw = await request<RawMessage>(
    `/api/mini/message/${messageId}/read`,
    { method: "PUT" },
    token
  );
  return normalizeMessage(raw);
}

export async function submitConsultationFeedback(
  token: string,
  consultationId: number,
  payload: ConsultationFeedbackPayload
) {
  return request(
    `/api/mini/patient/consultations/${consultationId}/feedback`,
    { method: "POST", body: JSON.stringify(payload) },
    token
  );
}

export async function submitRefundExemption(
  token: string,
  consultationId: number,
  payload: RefundExemptionPayload
) {
  return request(
    `/api/mini/patient/consultations/${consultationId}/refund-exemption`,
    { method: "POST", body: JSON.stringify(payload) },
    token
  );
}
