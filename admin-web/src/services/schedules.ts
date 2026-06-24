import { apiRequest } from "@/lib/api";
import type { ScheduleOverview } from "@/types/api";

import { getLocalDateValue } from "@/lib/date";

export function fetchScheduleOverview(date = getLocalDateValue()) {
  return apiRequest<ScheduleOverview>(`/api/mini/ops/schedules/overview?date=${date}`);
}
