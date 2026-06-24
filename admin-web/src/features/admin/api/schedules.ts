import { apiRequest } from "@/lib/api";
import type { ScheduleOverview } from "@/types/api";

import { today } from "../constants";

export function fetchScheduleOverview(date = today) {
  return apiRequest<ScheduleOverview>(`/api/mini/ops/schedules/overview?date=${date}`);
}
