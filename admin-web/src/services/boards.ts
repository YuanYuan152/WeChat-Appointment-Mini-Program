import { apiFileRequest, apiRequest } from "@/lib/api";
import type {
  CounselorBoardDetail,
  CounselorBoardSummary,
  PatientContractInfo,
  PatientContractArtifact,
  PagedResult,
  StaffRemarkUpdateResult,
  UserBoardDetail,
  UserBoardSummary,
} from "@/types/api";

import type { PaginationParams, UserBoardFilters } from "@/types/app";

/** 与小程序管理端共用 /api/mini/admin；看板走 /boards/*，避免与 /patients/{id} 冲突。 */
const PATIENT_BOARD = "/api/mini/admin/boards/patients";
const COUNSELOR_BOARD = "/api/mini/admin/boards/counselors";

export function fetchUserBoard(filters: UserBoardFilters, pagination: PaginationParams) {
  const params = new URLSearchParams({
    page: String(pagination.page),
    page_size: String(pagination.pageSize),
  });
  if (filters.keyword) {
    params.set("keyword", filters.keyword);
  }
  if (filters.mobile) {
    params.set("mobile", filters.mobile);
  }

  return apiRequest<PagedResult<UserBoardSummary>>(`${PATIENT_BOARD}?${params.toString()}`);
}

export function fetchUserBoardDetail(accountId: number) {
  return apiRequest<UserBoardDetail>(`${PATIENT_BOARD}/${accountId}`);
}

export function fetchPatientContractInfo(accountId: number) {
  return apiRequest<PatientContractInfo>(`/api/mini/admin/patients/${accountId}`);
}

export function fetchPatientContractArtifact(accountId: number) {
  return apiRequest<PatientContractArtifact>(`${PATIENT_BOARD}/${accountId}/contract-material`);
}

export function downloadPatientContractSignature(path: string) {
  return apiFileRequest(path);
}

export function updatePatientBoundCounselor(accountId: number, counselorId: number | null) {
  return apiRequest<PatientContractInfo>(`/api/mini/admin/patients/${accountId}/bound-counselor`, {
    method: "PUT",
    body: JSON.stringify({ counselorId }),
  });
}

export function updatePatientSourceDetail(
  accountId: number,
  patientSource: string,
  patientSourceDetail: string,
) {
  return apiRequest<UserBoardSummary>(`${PATIENT_BOARD}/${accountId}/source`, {
    method: "PUT",
    body: JSON.stringify({ patientSource, patientSourceDetail }),
  });
}

export function updateStaffRemark(accountId: number, remark: string) {
  return apiRequest<StaffRemarkUpdateResult>(`/api/mini/admin/accounts/${accountId}/staff-remark`, {
    method: "PUT",
    body: JSON.stringify({ remark }),
  });
}

export function fetchCounselorBoard(keyword: string, pagination: PaginationParams) {
  const params = new URLSearchParams({
    page: String(pagination.page),
    page_size: String(pagination.pageSize),
  });
  if (keyword) {
    params.set("keyword", keyword);
  }

  return apiRequest<PagedResult<CounselorBoardSummary>>(`${COUNSELOR_BOARD}?${params.toString()}`);
}

export function fetchCounselorBoardDetail(accountId: number) {
  return apiRequest<CounselorBoardDetail>(`${COUNSELOR_BOARD}/${accountId}`);
}
