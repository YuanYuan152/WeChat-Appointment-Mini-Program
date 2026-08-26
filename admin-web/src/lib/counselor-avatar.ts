const AVATAR_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const COUNSELOR_AVATAR_MAX_BYTES = 10 * 1024 * 1024;
/** 与后端 counselor_avatar.DEFAULT_COUNSELOR_PUBLIC_AVATAR 一致（网站可访问 /static/） */
export const DEFAULT_COUNSELOR_PUBLIC_AVATAR = "/static/images/counselor-avatar.png";

const LEGACY_DEFAULT_COUNSELOR_AVATARS = new Set([
  "/static/images-opt/counselor-avatar.png",
  "/static/images-opt/counselor-avatar.jpg",
]);

export function getCounselorAvatarFileError(
  file: Pick<File, "type" | "size">,
): string | null {
  if (!AVATAR_CONTENT_TYPES.has(file.type.toLowerCase())) {
    return "仅支持 JPEG、PNG 或 WebP 图片";
  }
  if (file.size <= 0) {
    return "头像文件不能为空";
  }
  if (file.size > COUNSELOR_AVATAR_MAX_BYTES) {
    return "头像大小不能超过 10MB";
  }
  return null;
}

/** 将咨询师头像转为可在 admin-web 预览的绝对 URL；空值/旧默认回退公开默认图。 */
export function resolveCounselorAvatarPreviewUrl(
  value: string | null | undefined,
  apiBaseUrl: string,
): string {
  const base = apiBaseUrl.replace(/\/$/, "");
  const fallback = `${base}${DEFAULT_COUNSELOR_PUBLIC_AVATAR}`;
  const raw = (value || "").trim();
  const trimmed =
    !raw || LEGACY_DEFAULT_COUNSELOR_AVATARS.has(raw)
      ? DEFAULT_COUNSELOR_PUBLIC_AVATAR
      : raw;
  try {
    const resolved = new URL(trimmed, `${base}/`);
    if (!["http:", "https:", "blob:", "data:"].includes(resolved.protocol)) {
      return fallback;
    }
    return resolved.toString();
  } catch {
    return fallback;
  }
}
