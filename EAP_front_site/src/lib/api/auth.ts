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

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("网络异常，请检查网络后重试");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errorMessageFrom(data));
  }
  return data as T;
}

/** 错误体同时带 FastAPI 原有的 detail 和统一的 msg；detail 为参数校验错误数组时退回 msg。 */
function errorMessageFrom(data: unknown): string {
  const body = (data ?? {}) as { detail?: unknown; msg?: unknown };
  if (typeof body.detail === "string" && body.detail.trim()) {
    return body.detail;
  }
  if (typeof body.msg === "string" && body.msg.trim()) {
    return body.msg;
  }
  return "请求失败";
}

export function sendCode(phone: string, purpose: "login" | "register") {
  return request<SendCodeResponse>("/api/web/auth/send-code", {
    method: "POST",
    body: JSON.stringify({ phone, purpose }),
  });
}

export function registerWithCode(phone: string, code: string, password: string) {
  return request<AuthTokenResponse>("/api/web/auth/register", {
    method: "POST",
    body: JSON.stringify({ phone, code, password }),
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

export function loginWithDevCode(code: string) {
  return request<AuthTokenResponse>("/api/mini/auth/login", {
    method: "POST",
    body: JSON.stringify({ code }),
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
