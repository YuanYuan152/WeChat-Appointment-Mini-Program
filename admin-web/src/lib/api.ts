import type { CurrentUser, LoginResponse } from "@/types/api";

export type DevLoginCode = "dev_admin" | "dev_ops" | "dev_counselor";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const TOKEN_KEY = "lxxl_admin_web_token";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredToken() {
  if (!canUseStorage()) {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  if (canUseStorage()) {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearStoredToken() {
  if (canUseStorage()) {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "msg" in payload) {
    const msg = (payload as { msg?: unknown }).msg;
    if (typeof msg === "string") {
      return msg;
    }
  }
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
  }
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return fallback;
}

function isApiEnvelope(payload: unknown): payload is { code: number; msg?: string; data: unknown } {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "code" in payload &&
      typeof (payload as { code?: unknown }).code === "number" &&
      "data" in payload,
  );
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getStoredToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      getErrorMessage(payload, `请求失败：HTTP ${response.status}`),
      payload,
    );
  }

  if (isApiEnvelope(payload)) {
    if (payload.code !== 0) {
      throw new ApiError(
        response.status,
        getErrorMessage(payload, "请求失败"),
        payload,
      );
    }
    return payload.data as T;
  }

  return payload as T;
}

export async function loginWithDevCode(code: DevLoginCode) {
  const result = await apiRequest<LoginResponse>("/api/mini/auth/login", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  setStoredToken(result.token);
  return result;
}

export function fetchCurrentUser() {
  return apiRequest<CurrentUser>("/api/mini/auth/me");
}
