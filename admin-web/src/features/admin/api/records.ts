import { apiRequest } from "@/lib/api";
import type { CounselorRecordSummary, OperationRecord, PagedResult } from "@/types/api";

import type { OperationFilters } from "../types";

export function fetchCounselorRecordSummary(days = 30) {
  return apiRequest<CounselorRecordSummary[]>(`/api/mini/admin/consultation-records/counselors?days=${days}`);
}

export function fetchOperationRecords(filters: OperationFilters) {
  const params = new URLSearchParams({ page: "1", page_size: "50" });
  if (filters.keyword) {
    params.set("keyword", filters.keyword);
  }
  if (filters.role) {
    params.set("role", filters.role);
  }
  if (filters.actionType) {
    params.set("action_type", filters.actionType);
  }

  return apiRequest<PagedResult<OperationRecord>>(`/api/web/admin/operation-records?${params.toString()}`);
}
