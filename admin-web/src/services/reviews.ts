import { apiRequest } from "@/lib/api";
import type { AdminLeaveRequestDetail } from "@/types/api";

export type ReviewStatus = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export async function fetchLeaveRequests(status: ReviewStatus = "ALL", keyword = "") {
  const items: AdminLeaveRequestDetail[] = [];
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({
      status,
      offset: String(offset),
      limit: String(pageSize),
    });
    const normalizedKeyword = keyword.trim();
    if (normalizedKeyword) {
      params.set("keyword", normalizedKeyword);
    }
    const page = await apiRequest<AdminLeaveRequestDetail[]>(
      `/api/mini/admin/leave-requests?${params.toString()}`,
    );
    items.push(...page);
    if (page.length < pageSize) {
      return items;
    }
  }
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
