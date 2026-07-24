import { apiRequest } from "@/lib/api";

export interface UploadFileResult {
  url: string;
  filename?: string;
}

export interface AssessmentImageUploadResult {
  path: string;
  url: string;
  filename: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  size: number;
  width: number;
  height: number;
}

const ASSESSMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ASSESSMENT_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<UploadFileResult>("/api/upload/file", {
    method: "POST",
    body: formData,
  });
}

export function getAssessmentImageUploadError(file: File): string | null {
  if (file.size <= 0) {
    return "图片文件不能为空";
  }
  if (
    file.type &&
    !ASSESSMENT_IMAGE_CONTENT_TYPES.has(file.type.toLowerCase())
  ) {
    return "仅支持 JPG、PNG 或 WebP 图片";
  }
  if (file.size > ASSESSMENT_IMAGE_MAX_BYTES) {
    return "图片大小不能超过 5MB";
  }
  return null;
}

export async function uploadAssessmentImage(
  file: File,
  signal?: AbortSignal,
): Promise<AssessmentImageUploadResult> {
  const validationError = getAssessmentImageUploadError(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const formData = new FormData();
  formData.append("file", file);

  const result = await apiRequest<AssessmentImageUploadResult>(
    "/api/mini/admin/assessments/assets",
    {
      method: "POST",
      body: formData,
      signal,
    },
  );
  if (!result.path?.trim()) {
    throw new Error("上传接口未返回受控图片路径");
  }
  return {
    ...result,
    path: result.path.trim(),
    url: result.url?.trim() || result.path.trim(),
  };
}
