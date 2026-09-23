import { apiRequest } from "@/lib/api";
import type { AssessmentEnterprise, PrivateAssessmentOption } from "@/types/api";

const BASE_PATH = "/api/mini/admin/assessment-enterprises";

export function fetchAssessmentEnterprises() {
  return apiRequest<AssessmentEnterprise[]>(BASE_PATH);
}

export function fetchPrivateAssessmentOptions() {
  return apiRequest<PrivateAssessmentOption[]>(`${BASE_PATH}/private-assessments`);
}

export function saveAssessmentEnterprise(input: {
  id?: string;
  companyName: string;
  url: string;
  assessmentIds: string[];
}) {
  return apiRequest<AssessmentEnterprise>(input.id ? `${BASE_PATH}/${input.id}` : BASE_PATH, {
    method: input.id ? "PUT" : "POST",
    body: JSON.stringify({
      companyName: input.companyName,
      url: input.url,
      assessmentIds: input.assessmentIds,
    }),
  });
}

export function deleteAssessmentEnterprise(id: string) {
  return apiRequest<{ message: string }>(`${BASE_PATH}/${id}`, { method: "DELETE" });
}

export function generateAssessmentEnterpriseQrCode(id: string) {
  return apiRequest<string>(`${BASE_PATH}/${id}/qrcode`);
}
