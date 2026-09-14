"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { getLocalDateValue } from "@/lib/date";
import { OpsCounselorSchedulePanel } from "@/panels/OpsCounselorSchedulePanel";
import {
  fetchOpsCounselorScheduleCalendar,
  fetchScheduleRescheduleOptions,
  rescheduleSchedule,
} from "@/services/schedules";
import type { CounselorScheduleCalendar } from "@/types/api";

export function OpsCounselorScheduleScreen() {
  return (
    <AppRoute sectionId="schedules">
      <OpsCounselorScheduleScreenContent />
    </AppRoute>
  );
}

function OpsCounselorScheduleScreenContent() {
  const params = useParams<{ counselorId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const counselorId = Number(params.counselorId);
  const counselorName = searchParams.get("name") || "咨询师";
  const initialDate = searchParams.get("date") || getLocalDateValue();
  const [month, setMonth] = useState(initialDate.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [calendar, setCalendar] = useState<CounselorScheduleCalendar>();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(counselorId) || counselorId <= 0) return;
    setLoading(true);
    clearNotice();
    try {
      setCalendar(await fetchOpsCounselorScheduleCalendar(counselorId, { month }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询师排期加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearNotice, counselorId, month, showNotice]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <OpsCounselorSchedulePanel
      calendar={calendar}
      counselorName={counselorName}
      loading={loading}
      month={month}
      selectedDate={selectedDate}
      onBack={() => router.push("/schedules")}
      onDateChange={setSelectedDate}
      onLoadRescheduleOptions={fetchScheduleRescheduleOptions}
      onMonthChange={(nextMonth) => {
        setMonth(nextMonth);
        setSelectedDate(`${nextMonth}-01`);
      }}
      onReschedule={async (scheduleId, input) => {
        try {
          const result = await rescheduleSchedule(scheduleId, input);
          showNotice("success", result.message || "咨询时间已修改");
          const targetDate = result.startTime.slice(0, 10);
          const targetMonth = targetDate.slice(0, 7);
          setSelectedDate(targetDate);
          if (targetMonth === month) await load();
          else setMonth(targetMonth);
          return true;
        } catch (error) {
          showNotice("error", error instanceof Error ? error.message : "修改咨询时间失败");
          return false;
        }
      }}
    />
  );
}
