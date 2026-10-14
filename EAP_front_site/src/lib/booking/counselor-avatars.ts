/**
 * 与小程序 frontend/src/utils/image.ts 中 resolveCounselorPublicAvatar 对齐：
 * 使用后端 /api/mini/common/counselors 返回的 avatarUrl（AppCounselorProfile.AvatarUrl），
 * 不再使用本地姓名映射图。
 */

import { resolveMediaUrl } from "@/lib/booking/utils";

/** 与 backend counselor_avatar.DEFAULT_COUNSELOR_PUBLIC_AVATAR 一致 */
export const DEFAULT_COUNSELOR_PUBLIC_AVATAR = "/static/images/counselor-avatar.png";

const LEGACY_DEFAULT_COUNSELOR_AVATARS = new Set([
  "/static/images-opt/counselor-avatar.png",
  "/static/images-opt/counselor-avatar.jpg",
]);

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000"
).replace(/\/$/, "");

/** 上传目录绝对/相对地址统一改写到当前 API，与小程序 toCurrentUploadUrl 一致 */
function toCurrentUploadUrl(value: string): string | null {
  let pathname = value;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      pathname = new URL(value).pathname;
    } catch {
      return null;
    }
  }
  if (pathname.startsWith("/static/uploads/") || pathname.startsWith("/api/static/")) {
    return `${API_BASE}${pathname}`;
  }
  return null;
}

/**
 * 解析咨询师对外展示头像（列表 / 详情 / 预约记录）。
 * @param imagePath 后端 avatarUrl / counselorAvatar
 */
export function resolveCounselorPublicAvatar(imagePath?: string | null): string {
  const trimmed = (imagePath || "").trim();
  if (!trimmed || LEGACY_DEFAULT_COUNSELOR_AVATARS.has(trimmed)) {
    return `${API_BASE}${DEFAULT_COUNSELOR_PUBLIC_AVATAR}`;
  }

  const uploadUrl = toCurrentUploadUrl(trimmed);
  if (uploadUrl) {
    return uploadUrl;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed === DEFAULT_COUNSELOR_PUBLIC_AVATAR) {
    return `${API_BASE}${DEFAULT_COUNSELOR_PUBLIC_AVATAR}`;
  }

  return resolveMediaUrl(trimmed) || `${API_BASE}${DEFAULT_COUNSELOR_PUBLIC_AVATAR}`;
}

/** @deprecated 请改用 resolveCounselorPublicAvatar(avatarUrl) */
export function resolveCounselorAvatar(
  avatarUrlOrName?: string | null,
  counselorIdOrName?: number | string | null,
  maybeId?: number | null,
): string {
  // 兼容旧签名 resolveCounselorAvatar(name, id) —— 若第二参是 number 且第一参不像 URL，走默认头像
  const first = (avatarUrlOrName || "").trim();
  const looksLikeAvatarPath =
    first.startsWith("http://") ||
    first.startsWith("https://") ||
    first.startsWith("/static/") ||
    first.startsWith("/api/static/");

  if (looksLikeAvatarPath || (typeof counselorIdOrName !== "number" && maybeId == null)) {
    return resolveCounselorPublicAvatar(first || null);
  }
  // 旧调用：resolveCounselorAvatar(name, id) —— 无 avatarUrl 时用默认
  return resolveCounselorPublicAvatar(null);
}
