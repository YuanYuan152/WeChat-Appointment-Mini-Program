import { apiRequest } from "@/lib/api";
import type { MessageItem } from "@/types/api";

export function fetchMessages(unreadOnly = false) {
  return apiRequest<MessageItem[]>(`/api/mini/message/list?unread_only=${unreadOnly}`);
}

export function markMessageRead(id: number) {
  return apiRequest<MessageItem>(`/api/mini/message/${id}/read`, { method: "PUT" });
}
