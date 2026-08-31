import { apiRequest } from "@/lib/api";
import type { FeedbackItem } from "@/types/api";

export async function fetchSystemFeedbacks(status = "ALL") {
  const params = new URLSearchParams({
    status,
  });
  return apiRequest<FeedbackItem[]>(`/api/web/admin/system-feedbacks?${params.toString()}`);
}

export async function updateSystemFeedbackStatus(feedbackId: number, status: "OPEN" | "CLOSED") {
  return apiRequest<FeedbackItem>(`/api/web/admin/system-feedbacks/${feedbackId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
