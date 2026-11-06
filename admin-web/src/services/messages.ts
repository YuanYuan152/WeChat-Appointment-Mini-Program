import { apiRequest } from "@/lib/api";
import type { AdminLeaveRequestDetail, MessageItem } from "@/types/api";

export const MESSAGE_UNREAD_CHANGED_EVENT = "lxxl-admin-web-messages-updated";

export interface MessageQueryOptions {
  unreadOnly?: boolean;
  category?: string;
  keyword?: string;
}

export function fetchMessages(options: boolean | MessageQueryOptions = false) {
  const queryOptions = typeof options === "boolean" ? { unreadOnly: options } : options;
  const params = new URLSearchParams();
  params.set("unread_only", queryOptions.unreadOnly ? "true" : "false");

  if (queryOptions.category) {
    params.set("category", queryOptions.category);
  }
  if (queryOptions.keyword?.trim()) {
    params.set("q", queryOptions.keyword.trim());
  }

  return apiRequest<MessageItem[]>(`/api/mini/message/list?${params.toString()}`);
}

export function fetchUnreadMessageCount(category?: string) {
  const params = new URLSearchParams();
  if (category) {
    params.set("category", category);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<{ count: number }>(`/api/mini/message/unread-count${suffix}`);
}

export function fetchMessageDetail(id: number) {
  return apiRequest<MessageItem>(`/api/mini/message/${id}`);
}

export function fetchMessageLeaveRequestDetail(id: number) {
  return apiRequest<AdminLeaveRequestDetail>(`/api/mini/admin/leave-requests/${id}`);
}

export function markMessageRead(id: number) {
  return apiRequest<MessageItem>(`/api/mini/message/${id}/read`, { method: "PUT" });
}

export function fetchTodayMessageDigest() {
  return apiRequest<{
    cancelledCount: number;
    newBookingCount: number;
    leavePendingCount: number;
    visitorCancelPendingCount: number;
    recordAmendmentPendingCount: number;
  }>("/api/mini/message/today-digest");
}

export function confirmOfflinePaymentReceipt(id: number, operatorName: string) {
  return apiRequest<MessageItem>(`/api/mini/message/${id}/confirm-offline-receipt`, {
    method: "POST",
    body: JSON.stringify({ operator_name: operatorName }),
  });
}
