import { apiRequest } from "@/lib/api";
import type {
  AssessmentReportDetail,
  AssessmentReportListFilters,
  AssessmentReportPage,
  AssessmentReportSource,
  PatientAssessmentReportListFilters,
} from "@/types/assessmentReport";

const ASSESSMENT_REPORTS_PATH = "/api/mini/admin/assessment-reports";
const PATIENT_BOARDS_PATH = "/api/mini/admin/boards/patients";

function setTrimmedParam(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  const normalized = value?.trim();
  if (normalized) {
    params.set(key, normalized);
  }
}

export function fetchAssessmentReports(filters: AssessmentReportListFilters) {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.pageSize),
  });

  setTrimmedParam(params, "keyword", filters.keyword);
  setTrimmedParam(params, "assessment_id", filters.assessmentId);
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.source) {
    params.set("source", filters.source);
  }
  setTrimmedParam(params, "start_at", filters.startAt);
  setTrimmedParam(params, "end_at", filters.endAt);

  return apiRequest<AssessmentReportPage>(
    `${ASSESSMENT_REPORTS_PATH}?${params.toString()}`,
  );
}

export function fetchPatientAssessmentReports(
  accountId: number,
  filters: PatientAssessmentReportListFilters,
) {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.pageSize),
  });

  if (filters.source) {
    params.set("source", filters.source);
  }

  return apiRequest<AssessmentReportPage>(
    `${PATIENT_BOARDS_PATH}/${accountId}/assessment-reports?${params.toString()}`,
  );
}

export function fetchAssessmentReportDetail(
  source: AssessmentReportSource,
  reportId: string,
) {
  return apiRequest<AssessmentReportDetail>(
    `${ASSESSMENT_REPORTS_PATH}/${encodeURIComponent(source)}/${encodeURIComponent(reportId)}`,
  );
}
