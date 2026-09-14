import { apiRequest } from "@/lib/api";
import type {
  CounselorScheduleCalendar,
  ScheduleOverview,
  ScheduleRescheduleOptions,
  ScheduleRescheduleResult,
} from "@/types/api";

const BASE_PATH = "/api/mini/ops/schedules";

export function fetchScheduleOverview(keyword = "") {
  const params = new URLSearchParams();
  if (keyword.trim()) params.set("keyword", keyword.trim());
  const query = params.toString();
  return apiRequest<ScheduleOverview>(`${BASE_PATH}/overview${query ? `?${query}` : ""}`);
}

export function fetchOpsCounselorScheduleCalendar(
  counselorId: number,
  input: { month?: string; start?: string; days?: number } = {},
) {
  const params = new URLSearchParams();
  if (input.month) params.set("month", input.month);
  if (input.start) params.set("start", input.start);
  if (input.days) params.set("days", String(input.days));
  const query = params.toString();
  return apiRequest<CounselorScheduleCalendar>(
    `${BASE_PATH}/counselors/${counselorId}/calendar${query ? `?${query}` : ""}`,
  );
}

export function fetchScheduleRescheduleOptions(scheduleId: number, date: string) {
  return apiRequest<ScheduleRescheduleOptions>(
    `${BASE_PATH}/${scheduleId}/reschedule-options?date=${encodeURIComponent(date)}`,
  );
}

export function rescheduleSchedule(
  scheduleId: number,
  input: { startTime: string; endTime: string; roomId?: string; reason: string },
) {
  return apiRequest<ScheduleRescheduleResult>(`${BASE_PATH}/${scheduleId}/reschedule`, {
    method: "PUT",
    body: JSON.stringify({
      start_time: input.startTime,
      end_time: input.endTime,
      room_id: input.roomId || null,
      reason: input.reason.trim(),
    }),
  });
}
