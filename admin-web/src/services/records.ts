import { apiRequest } from "@/lib/api";
import type {
  AdminCaseRecordDetail,
  AdminConsultationRecord,
  CaseRecordAmendment,
  CounselorRecordSummary,
  OperationRecord,
  PagedResult,
} from "@/types/api";

import type { OperationFilters, PaginationParams } from "@/types/app";

export type CaseRecordPeriod = "all" | "month" | "week" | "today";

export function fetchCounselorRecordSummary(options?: {
  period?: CaseRecordPeriod;
  days?: number;
  keyword?: string;
}) {
  const params = new URLSearchParams();
  if (options?.period) {
    params.set("period", options.period);
  } else if (options?.days != null) {
    params.set("days", String(options.days));
  } else {
    params.set("period", "month");
  }
  if (options?.keyword?.trim()) {
    params.set("keyword", options.keyword.trim());
  }
  return apiRequest<CounselorRecordSummary[]>(
    `/api/mini/admin/consultation-records/counselors?${params.toString()}`,
  );
}

export function fetchCounselorRecordDetails(
  counselorId: number,
  options?: { period?: CaseRecordPeriod; days?: number },
) {
  const params = new URLSearchParams();
  if (options?.period) {
    params.set("period", options.period);
  } else if (options?.days != null) {
    params.set("days", String(options.days));
  } else {
    params.set("period", "month");
  }
  return apiRequest<AdminConsultationRecord[]>(
    `/api/mini/admin/consultation-records/counselors/${counselorId}?${params.toString()}`,
  );
}

export function fetchCaseRecordDetail(recordId: number) {
  return apiRequest<AdminCaseRecordDetail>(`/api/mini/admin/consultation-records/records/${recordId}`);
}

export function fetchCaseRecordAmendments(options?: {
  status?: string;
  keyword?: string;
  period?: CaseRecordPeriod;
}) {
  const params = new URLSearchParams({
    status: options?.status || "PENDING",
    period: options?.period || "month",
  });
  const normalizedKeyword = (options?.keyword || "").trim();
  if (normalizedKeyword) {
    params.set("keyword", normalizedKeyword);
  }
  return apiRequest<CaseRecordAmendment[]>(`/api/mini/admin/case-record-amendments?${params.toString()}`);
}

export function approveCaseRecordAmendment(amendmentId: number) {
  return apiRequest(`/api/mini/admin/case-record-amendments/${amendmentId}/approve`, { method: "POST" });
}

export function rejectCaseRecordAmendment(amendmentId: number, rejectReason: string) {
  return apiRequest(`/api/mini/admin/case-record-amendments/${amendmentId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reject_reason: rejectReason }),
  });
}

export function fetchOperationRecords(filters: OperationFilters, pagination: PaginationParams) {
  const params = new URLSearchParams({
    page: String(pagination.page),
    page_size: String(pagination.pageSize),
  });
  if (filters.keyword) {
    params.set("keyword", filters.keyword);
  }
  if (filters.role) {
    params.set("role", filters.role);
  }
  if (filters.actionType) {
    params.set("action_type", filters.actionType);
  }
  if (filters.operatorId) {
    params.set("operator_id", filters.operatorId);
  }
  if (filters.startAt) {
    params.set("start_at", `${filters.startAt}T00:00:00`);
  }
  if (filters.endAt) {
    params.set("end_at", `${filters.endAt}T23:59:59`);
  }

  return apiRequest<PagedResult<OperationRecord>>(`/api/web/admin/operation-records?${params.toString()}`);
}
