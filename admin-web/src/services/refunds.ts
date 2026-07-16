import { apiRequest } from "@/lib/api";
import type { RefundExemption } from "@/types/api";

export async function fetchRefundExemptions(
  status: "ALL" | "PENDING" | "APPROVED" | "REJECTED" = "ALL",
  keyword = "",
) {
  const items: RefundExemption[] = [];
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
    const page = await apiRequest<RefundExemption[]>(
      `/api/mini/admin/refund-exemptions?${params.toString()}`,
    );
    items.push(...page);
    if (page.length < pageSize) {
      return items;
    }
  }
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
