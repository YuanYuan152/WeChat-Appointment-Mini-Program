const AVATAR_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const COUNSELOR_AVATAR_MAX_BYTES = 10 * 1024 * 1024;

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
