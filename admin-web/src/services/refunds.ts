import { apiRequest } from "@/lib/api";
import type { RefundExemption } from "@/types/api";

export function fetchRefundExemptions(status: "ALL" | "PENDING" = "ALL") {
  return apiRequest<RefundExemption[]>(`/api/mini/admin/refund-exemptions?status=${status}`);
}

export function approveRefundExemption(id: number) {
  return apiRequest(`/api/mini/admin/refund-exemptions/${id}/approve`, { method: "POST" });
}

export function rejectRefundExemption(id: number, reason: string) {
  return apiRequest(`/api/mini/admin/refund-exemptions/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reject_reason: reason }),
  });
}
