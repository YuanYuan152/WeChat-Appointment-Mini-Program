const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000";

export interface AuthUser {
  id: number;
  openId?: string | null;
  mobile?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  realName?: string | null;
  gender?: string | null;
  roles: string[];
  activeRole?: string | null;
  hasPreferenceTags?: boolean;
  personalTags?: string[];
  interestTags?: string[];
}

export interface TagOptionsResponse {
  personalTags: string[];
  interestTags: string[];
  maxPerCategory: number;
}

export interface AuthTokenResponse {
  token: string;
  is_new_user: boolean;
}

export interface SendCodeResponse {
  message: string;
  expiresIn: number;
  resendAfter: number;
  mockCode?: string;
}

interface ApiEnvelope<T> {
  code: number;
  msg?: string;
  data: T;
  detail?: unknown;
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return Boolean(
    value &&
      typeof value === "object" &&
      "code" in value &&
      typeof (value as { code?: unknown }).code === "number" &&
      "data" in value
  );
}

function errorMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const payload = value as { detail?: unknown; msg?: unknown; message?: unknown };
  for (const candidate of [payload.detail, payload.msg, payload.message]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return fallback;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const payload: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errorMessage(payload, "请求失败"));
  }
  if (isApiEnvelope<T>(payload)) {
    if (payload.code !== 0) {
      throw new Error(errorMessage(payload, "请求失败"));
    }
    return payload.data;
  }
  return payload as T;
}

export function sendCode(phone: string, purpose: "login" | "register") {
  return request<SendCodeResponse>("/api/web/auth/send-code", {
    method: "POST",
    body: JSON.stringify({ phone, purpose }),
  });
}

export function registerWithCode(phone: string, code: string) {
  return request<AuthTokenResponse>("/api/web/auth/register", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export function loginWithCode(phone: string, code: string) {
  return request<AuthTokenResponse>("/api/web/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}


export function fetchMe(token: string) {
  return request<AuthUser>("/api/web/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchTagOptions() {
  return request<TagOptionsResponse>("/api/web/auth/tag-options");
}

export function savePreferenceTags(
  token: string,
  personalTags: string[],
  interestTags: string[]
) {
  return request<AuthUser>("/api/web/auth/preference-tags", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ personalTags, interestTags }),
  });
}
