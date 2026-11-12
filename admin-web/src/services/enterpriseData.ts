import { apiFileRequest, apiRequest } from "@/lib/api";
import type {
  EnterpriseAnnotation,
  EnterpriseAnnotationInput,
  EnterpriseDataSummary,
  EnterpriseDataset,
  EnterpriseFollowUp,
  EnterpriseFollowUpInput,
  EnterpriseRespondentDetail,
  EnterpriseTagGroup,
} from "@/types/enterpriseData";

const BASE_PATH = "/api/mini/admin/assessment-enterprise-data";

function enterprisePath(enterpriseId: string) {
  return `${BASE_PATH}/${encodeURIComponent(enterpriseId)}`;
}

export function fetchEnterpriseDataSummaries() {
  return apiRequest<EnterpriseDataSummary[]>(BASE_PATH);
}

export function fetchEnterpriseDataset(enterpriseId: string) {
  return apiRequest<EnterpriseDataset>(`${enterprisePath(enterpriseId)}/dataset`);
}

export function fetchEnterpriseRespondentDetail(
  enterpriseId: string,
  respondentKey: string,
  accountIds: number[] = [],
) {
  const params = new URLSearchParams();
  if (accountIds.length) {
    params.set("account_ids", accountIds.slice(0, 200).join(","));
  }
  const query = params.toString();
  return apiRequest<EnterpriseRespondentDetail>(
    `${enterprisePath(enterpriseId)}/respondents/${encodeURIComponent(respondentKey)}${query ? `?${query}` : ""}`,
  );
}

export function createEnterpriseAnnotation(
  enterpriseId: string,
  respondentKey: string,
  input: EnterpriseAnnotationInput,
) {
  return apiRequest<EnterpriseAnnotation>(
    `${enterprisePath(enterpriseId)}/respondents/${encodeURIComponent(respondentKey)}/annotations`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function deleteEnterpriseAnnotation(enterpriseId: string, annotationId: number) {
  return apiRequest<{ message: string }>(
    `${enterprisePath(enterpriseId)}/annotations/${encodeURIComponent(String(annotationId))}`,
    { method: "DELETE" },
  );
}

export function saveEnterpriseFollowUp(
  enterpriseId: string,
  publicId: string,
  input: EnterpriseFollowUpInput,
) {
  return apiRequest<EnterpriseFollowUp>(
    `${enterprisePath(enterpriseId)}/reports/${encodeURIComponent(publicId)}/follow-up`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}

export function deleteEnterpriseReport(enterpriseId: string, publicId: string) {
  return apiRequest<{ message: string; publicId: string }>(
    `${enterprisePath(enterpriseId)}/reports/${encodeURIComponent(publicId)}`,
    { method: "DELETE" },
  );
}

export function saveEnterpriseTagLibrary(enterpriseId: string, groups: EnterpriseTagGroup[]) {
  return apiRequest<EnterpriseTagGroup[]>(`${enterprisePath(enterpriseId)}/tag-library`, {
    method: "PUT",
    body: JSON.stringify({ groups }),
  });
}

export function exportEnterpriseDataset(enterpriseId: string) {
  return apiFileRequest(`${enterprisePath(enterpriseId)}/export`);
}
