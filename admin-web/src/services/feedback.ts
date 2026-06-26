import { apiRequest } from "@/lib/api";
import type { FeedbackItem } from "@/types/api";

export function fetchFeedbacks(status = "ALL") {
  return apiRequest<FeedbackItem[]>(`/api/mini/feedback/admin?status=${status}`);
}
