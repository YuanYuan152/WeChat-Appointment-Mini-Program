import { apiRequest } from "@/lib/api";
import type { AdminLeaveRequestDetail } from "@/types/api";

export type ReviewStatus = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export function fetchLeaveRequests(status: ReviewStatus = "ALL") {
  return apiRequest<AdminLeaveRequestDetail[]>(
    `/api/mini/admin/leave-requests?status=${encodeURIComponent(status)}`,
  );
}

export function fetchLeaveRequest(id: number) {
  return apiRequest<AdminLeaveRequestDetail>(`/api/mini/admin/leave-requests/${id}`);
}

export function approveLeaveRequest(id: number) {
  return apiRequest(`/api/mini/admin/leave-requests/${id}/approve`, { method: "POST" });
}

export function rejectLeaveRequest(id: number, rejectReason: string) {
  return apiRequest(`/api/mini/admin/leave-requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ rejectReason }),
  });
}
