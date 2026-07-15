import { apiRequest } from "@/lib/api";

export interface UploadFileResult {
  url: string;
  filename?: string;
}

export function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<UploadFileResult>("/api/upload/file", {
    method: "POST",
    body: formData,
  });
}
