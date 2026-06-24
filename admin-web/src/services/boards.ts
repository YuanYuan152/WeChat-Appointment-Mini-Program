import { apiRequest } from "@/lib/api";
import type {
  CounselorBoardDetail,
  CounselorBoardSummary,
  PagedResult,
  UserBoardDetail,
  UserBoardSummary,
} from "@/types/api";

import type { PaginationParams, UserBoardFilters } from "@/types/app";

export function fetchUserBoard(filters: UserBoardFilters, pagination: PaginationParams) {
  const params = new URLSearchParams({
    page: String(pagination.page),
    page_size: String(pagination.pageSize),
  });
  if (filters.keyword) {
    params.set("keyword", filters.keyword);
  }
  if (filters.gender) {
    params.set("gender", filters.gender);
  }
  if (filters.mobile) {
    params.set("mobile", filters.mobile);
  }

  return apiRequest<PagedResult<UserBoardSummary>>(`/api/web/admin/users/board?${params.toString()}`);
}

export function fetchUserBoardDetail(accountId: number) {
  return apiRequest<UserBoardDetail>(`/api/web/admin/users/${accountId}/board`);
}

export function fetchCounselorBoard(keyword: string, pagination: PaginationParams) {
  const params = new URLSearchParams({
    page: String(pagination.page),
    page_size: String(pagination.pageSize),
  });
  if (keyword) {
    params.set("keyword", keyword);
  }

  return apiRequest<PagedResult<CounselorBoardSummary>>(`/api/web/admin/counselors/board?${params.toString()}`);
}

export function fetchCounselorBoardDetail(accountId: number) {
  return apiRequest<CounselorBoardDetail>(`/api/web/admin/counselors/${accountId}/board`);
}
