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
  mockCode?: string;
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

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail ?? "请求失败";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export function sendCode(phone: string, purpose: "login" | "register") {
  return request<SendCodeResponse>("/api/web/auth/send-code", {
    method: "POST",
    body: JSON.stringify({ phone, purpose }),
  });
}

export function registerWithCode(phone: string, code: string, password?: string) {
  return request<AuthTokenResponse>("/api/web/auth/register", {
    method: "POST",
    body: JSON.stringify({ phone, code, password: password || undefined }),
  });
}

export function registerWithPassword(phone: string, password: string) {
  return request<AuthTokenResponse>("/api/web/auth/register", {
    method: "POST",
    body: JSON.stringify({ phone, password }),
  });
}

export function loginWithCode(phone: string, code: string) {
  return request<AuthTokenResponse>("/api/web/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export function loginWithPassword(phone: string, password: string) {
  return request<AuthTokenResponse>("/api/web/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password }),
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
