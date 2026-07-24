import { apiRequest } from "@/lib/api";
import type {
  AssessmentAdminDetail,
  AssessmentDefinition,
  AssessmentListFilters,
  AssessmentListResponse,
  AssessmentVersionSummary,
} from "@/types/assessment";

function assessmentPath(assessmentId: string) {
  return `/api/mini/admin/assessments/${encodeURIComponent(assessmentId)}`;
}

export function fetchAssessments(filters: AssessmentListFilters) {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.pageSize),
  });

  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.keyword?.trim()) {
    params.set("keyword", filters.keyword.trim());
  }

  return apiRequest<AssessmentListResponse>(
    `/api/mini/admin/assessments?${params.toString()}`,
  );
}

export function fetchAssessmentDetail(assessmentId: string) {
  return apiRequest<AssessmentAdminDetail>(assessmentPath(assessmentId));
}

export function createAssessment(definition: AssessmentDefinition) {
  return apiRequest<AssessmentAdminDetail>("/api/mini/admin/assessments", {
    method: "POST",
    body: JSON.stringify({ definition }),
  });
}

export function updateAssessmentDraft(
  assessmentId: string,
  expectedRevision: string,
  definition: AssessmentDefinition,
) {
  return apiRequest<AssessmentAdminDetail>(`${assessmentPath(assessmentId)}/draft`, {
    method: "PUT",
    body: JSON.stringify({ expectedRevision, definition }),
  });
}

export function publishAssessment(assessmentId: string, expectedRevision: string) {
  return apiRequest<AssessmentAdminDetail>(`${assessmentPath(assessmentId)}/publish`, {
    method: "POST",
    body: JSON.stringify({ expectedRevision }),
  });
}

export function archiveAssessment(assessmentId: string) {
  return apiRequest<AssessmentAdminDetail>(`${assessmentPath(assessmentId)}/archive`, {
    method: "POST",
  });
}

export function fetchAssessmentVersions(assessmentId: string) {
  return apiRequest<AssessmentVersionSummary[]>(`${assessmentPath(assessmentId)}/versions`);
}

export function restoreAssessmentVersion(assessmentId: string, version: number) {
  return apiRequest<AssessmentAdminDetail>(
    `${assessmentPath(assessmentId)}/versions/${version}/restore`,
    { method: "POST" },
  );
}
