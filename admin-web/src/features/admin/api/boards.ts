import { apiRequest } from "@/lib/api";
import type {
  CounselorBoardDetail,
  CounselorBoardSummary,
  PagedResult,
  UserBoardDetail,
  UserBoardSummary,
} from "@/types/api";

export function fetchUserBoard(keyword: string) {
  const params = new URLSearchParams({ page: "1", page_size: "30" });
  if (keyword) {
    params.set("keyword", keyword);
  }

  return apiRequest<PagedResult<UserBoardSummary>>(`/api/web/admin/users/board?${params.toString()}`);
}

export function fetchUserBoardDetail(accountId: number) {
  return apiRequest<UserBoardDetail>(`/api/web/admin/users/${accountId}/board`);
}

export function fetchCounselorBoard(keyword: string) {
  const params = new URLSearchParams({ page: "1", page_size: "30" });
  if (keyword) {
    params.set("keyword", keyword);
  }

  return apiRequest<PagedResult<CounselorBoardSummary>>(`/api/web/admin/counselors/board?${params.toString()}`);
}

export function fetchCounselorBoardDetail(accountId: number) {
  return apiRequest<CounselorBoardDetail>(`/api/web/admin/counselors/${accountId}/board`);
}
