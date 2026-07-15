"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { getLocalDateValue } from "@/lib/date";
import { getMessage } from "@/lib/display";
import { CounselorSchedulesPanel, type CounselorScheduleDraft, type CounselorScheduleQuery } from "@/panels/CounselorSchedulesPanel";
import {
  cancelCounselorSchedule,
  createCounselorSchedule,
  fetchCounselorScheduleCalendar,
  fetchCounselorSlotOptions,
  submitCounselorLeaveRequest,
} from "@/services/counselor";
import type { CounselorSlotOption } from "@/types/api";
import type { ScreenData } from "@/types/app";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";

const INITIAL_QUERY = (start?: string | null): CounselorScheduleQuery => ({
  start: start || getLocalDateValue(),
  days: 14,
});

const INITIAL_DRAFT = (): CounselorScheduleDraft => ({
  date: getLocalDateValue(),
  centerId: "yangpu",
  slotKey: "",
  roomId: "",
});

export function CounselorSchedulesScreen() {
  return (
    <AppRoute sectionId="counselorSchedules">
      <CounselorSchedulesScreenContent />
    </AppRoute>
  );
}

function CounselorSchedulesScreenContent() {
  const searchParams = useSearchParams();
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const focusedScheduleId = numberFromSearchParam(searchParams.get("scheduleId"));
  const focusedConsultationId = numberFromSearchParam(searchParams.get("consultationId"));
  const focusedStart = dateFromSearchParam(searchParams.get("start"));
  const [data, setData] = useState<ScreenData>({});
  const [filters, setFilters] = useState(() => INITIAL_QUERY(focusedStart));
  const [draftFilters, setDraftFilters] = useState(() => INITIAL_QUERY(focusedStart));
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [listLoading, setListLoading] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const counselorScheduleCalendar = await fetchCounselorScheduleCalendar(filters);
      setData((prev) => ({ ...prev, counselorScheduleCalendar }));
      return true;
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "排期加载失败");
      return false;
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, filters, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  useEffect(() => {
    if (!focusedStart || filters.start === focusedStart) {
      return;
    }
    const next = INITIAL_QUERY(focusedStart);
    setDraftFilters(next);
    setFilters(next);
    setPage(1);
  }, [filters.start, focusedStart]);

  const search = useCallback(() => {
    setPage(1);
    if (filters.start === draftFilters.start && filters.days === draftFilters.days) {
      void loadData();
      return;
    }
    setFilters(draftFilters);
  }, [draftFilters, filters.days, filters.start, loadData]);

  const reset = useCallback(() => {
    const next = INITIAL_QUERY();
    setDraftFilters(next);
    setPage(1);
    if (filters.start === next.start && filters.days === next.days) {
      void loadData();
      return;
    }
    setFilters(next);
  }, [filters.days, filters.start, loadData]);

  const loadSlots = useCallback(async () => {
    setSlotLoading(true);
    setSlotError(null);
    try {
      const counselorSlotOptions = await fetchCounselorSlotOptions(draft.date, draft.centerId);
      setData((prev) => ({ ...prev, counselorSlotOptions }));
      setDraft((prev) => ({ ...prev, slotKey: "", roomId: "" }));
      return true;
    } catch (error) {
      setSlotError(error instanceof Error ? error.message : "可排时段加载失败");
      setData((prev) => ({ ...prev, counselorSlotOptions: undefined }));
      return false;
    } finally {
      setSlotLoading(false);
    }
  }, [draft.centerId, draft.date]);

  const createSchedule = useCallback(
    async (slot: CounselorSlotOption, roomId: string) => {
      clearNotice();
      setSlotError(null);
      try {
        const result = await createCounselorSchedule({
          start_time: slot.startTime,
          end_time: slot.endTime,
          center_id: draft.centerId,
          room_id: roomId || undefined,
        });
        showNotice("success", getMessage(result, "排期已新增"));
        await loadData();
        await loadSlots();
        return true;
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "新增排期失败");
        return false;
      }
    },
    [clearNotice, draft.centerId, loadData, loadSlots, showNotice],
  );

  const cancelSchedule = useCallback(
    async (scheduleId: number, reason?: string) => {
      clearNotice();
      try {
        const result = await cancelCounselorSchedule(scheduleId, { leave_reason: reason });
        showNotice("success", getMessage(result, "排期已取消"));
        await loadData();
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "取消排期失败");
      }
    },
    [clearNotice, loadData, showNotice],
  );

  const submitLeave = useCallback(
    async (
      scheduleId: number,
      reason: string,
      communicationScreenshotUrl: string,
    ) => {
      clearNotice();
      try {
        const result = await submitCounselorLeaveRequest(
          scheduleId,
          reason,
          communicationScreenshotUrl,
        );
        showNotice("success", getMessage(result, "请假申请已提交"));
        await loadData();
        return true;
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "请假申请提交失败");
        return false;
      }
    },
    [clearNotice, loadData, showNotice],
  );

  const changePageSize = useCallback((nextPageSize: number) => {
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  return (
    <CounselorSchedulesPanel
      calendar={data.counselorScheduleCalendar}
      slotOptions={data.counselorSlotOptions}
      listLoading={listLoading}
      slotLoading={slotLoading}
      slotError={slotError}
      query={draftFilters}
      draft={draft}
      page={page}
      pageSize={pageSize}
      focusedScheduleId={focusedScheduleId}
      focusedConsultationId={focusedConsultationId}
      setQuery={setDraftFilters}
      setDraft={setDraft}
      onSearch={search}
      onReset={reset}
      onClearSlotError={() => setSlotError(null)}
      onLoadSlots={loadSlots}
      onCreate={createSchedule}
      onCancel={cancelSchedule}
      onLeave={submitLeave}
      onProxyOrderCreated={async (message) => {
        const refreshed = await loadData();
        showNotice(
          refreshed ? "success" : "info",
          refreshed
            ? message || "订单已推送"
            : `${message || "订单已推送"}，但排期刷新失败，请手动刷新后核对`,
        );
      }}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
    />
  );
}

function numberFromSearchParam(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function dateFromSearchParam(value: string | null) {
  if (!value) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
