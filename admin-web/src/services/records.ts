import { apiRequest } from "@/lib/api";
import type {
  AdminCaseRecordDetail,
  AdminConsultationRecord,
  CounselorRecordSummary,
  OperationRecord,
  PagedResult,
} from "@/types/api";

import type { OperationFilters, PaginationParams } from "@/types/app";

export function fetchCounselorRecordSummary(days = 30) {
  return apiRequest<CounselorRecordSummary[]>(`/api/mini/admin/consultation-records/counselors?days=${days}`);
}

export function fetchCounselorRecordDetails(counselorId: number, days = 30) {
  return apiRequest<AdminConsultationRecord[]>(
    `/api/mini/admin/consultation-records/counselors/${counselorId}?days=${days}`,
  );
}

export function fetchCaseRecordDetail(recordId: number) {
  return apiRequest<AdminCaseRecordDetail>(`/api/mini/admin/consultation-records/records/${recordId}`);
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
