import { addLocalDays, getLocalDateValue, ROLLING_SCHEDULE_WINDOW_DAYS } from "@/lib/date";

export type CounselorScheduleViewMode = "list" | "calendar";

export interface CounselorScheduleQuery {
  mode: CounselorScheduleViewMode;
  start: string;
  days: number;
  month: string;
}

export interface CounselorScheduleRequest {
  start?: string;
  days: number;
  pastDays?: number;
  month?: string;
}

export function getCounselorScheduleHistoryMinDate(today = getLocalDateValue()) {
  return addLocalDays(today, -ROLLING_SCHEDULE_WINDOW_DAYS);
}

export function createCounselorScheduleQuery(
  focusedStart?: string | null,
  today = getLocalDateValue(),
): CounselorScheduleQuery {
  const start = focusedStart || today;
  const useMonth = Boolean(focusedStart && start < getCounselorScheduleHistoryMinDate(today));
  return {
    mode: useMonth ? "calendar" : "list",
    start: useMonth ? today : start,
    days: 14,
    month: start.slice(0, 7),
  };
}

export function toCounselorScheduleRequest(
  query: CounselorScheduleQuery,
  today = getLocalDateValue(),
): CounselorScheduleRequest {
  if (query.mode === "calendar") {
    return {
      days: query.days,
      month: query.month,
    };
  }
  return {
    start: query.start,
    days: query.days,
    pastDays: Math.min(
      ROLLING_SCHEDULE_WINDOW_DAYS,
      Math.max(0, differenceInCalendarDays(query.start, today)),
    ),
  };
}

export function counselorScheduleQueryKey(query: CounselorScheduleQuery) {
  return query.mode === "calendar"
    ? `calendar:${query.month}`
    : `list:${query.start}:${query.days}`;
}

function differenceInCalendarDays(earlier: string, later: string) {
  const earlierValue = dateValueAsUtc(earlier);
  const laterValue = dateValueAsUtc(later);
  if (earlierValue == null || laterValue == null) {
    return 0;
  }
  return Math.floor((laterValue - earlierValue) / 86_400_000);
}

function dateValueAsUtc(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
