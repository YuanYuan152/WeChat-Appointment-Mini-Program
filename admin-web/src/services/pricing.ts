import { apiRequest } from "@/lib/api";
import type {
  PricingCounselorListResponse,
  PricingCounselorSummary,
  PricingCounselorUpdatePayload,
  PricingBatchDefaultSharePayload,
  PricingBatchDefaultShareResult,
  PricingPatientListResponse,
  PricingPatientRow,
  PricingPatientUpdatePayload,
} from "@/types/api";

import type { PaginationParams } from "@/types/app";

export function fetchPricingCounselors(keyword: string) {
  const params = new URLSearchParams();
  if (keyword.trim()) {
    params.set("keyword", keyword.trim());
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<PricingCounselorListResponse>(`/api/mini/admin/pricing/counselors${suffix}`);
}

export function updatePricingCounselor(counselorId: number, payload: PricingCounselorUpdatePayload) {
  return apiRequest<PricingCounselorSummary>(`/api/mini/admin/pricing/counselors/${counselorId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function previewPricingBatchDefaultShare(payload: PricingBatchDefaultSharePayload) {
  return apiRequest<PricingBatchDefaultShareResult>(
    "/api/mini/admin/pricing/counselors/default-share/batch-preview",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updatePricingBatchDefaultShare(payload: PricingBatchDefaultSharePayload) {
  return apiRequest<PricingBatchDefaultShareResult>(
    "/api/mini/admin/pricing/counselors/default-share/batch",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchPricingPatients(
  counselorId: number,
  keyword: string,
  pagination: PaginationParams,
) {
  const params = new URLSearchParams({
    page: String(pagination.page),
    page_size: String(pagination.pageSize),
  });
  if (keyword.trim()) {
    params.set("keyword", keyword.trim());
  }
  return apiRequest<PricingPatientListResponse>(
    `/api/mini/admin/pricing/counselors/${counselorId}/patients?${params.toString()}`,
  );
}

export function updatePricingPatient(
  counselorId: number,
  patientId: number,
  payload: PricingPatientUpdatePayload,
) {
  return apiRequest<PricingPatientRow>(
    `/api/mini/admin/pricing/counselors/${counselorId}/patients/${patientId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}
