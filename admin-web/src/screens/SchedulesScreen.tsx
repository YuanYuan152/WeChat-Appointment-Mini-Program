"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchScheduleOverview } from "@/services/schedules";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { SchedulesPanel } from "@/panels/SchedulesPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { getLocalDateValue } from "@/lib/date";
import type { ScreenData } from "@/types/app";

export function SchedulesScreen() {
  return (
    <AppRoute sectionId="schedules">
      <SchedulesScreenContent />
    </AppRoute>
  );
}

function SchedulesScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateValue());
  const [queryDate, setQueryDate] = useState(() => getLocalDateValue());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const schedules = await fetchScheduleOverview(queryDate);
      setData((prev) => ({ ...prev, schedules }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "排期情况加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, queryDate, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const search = useCallback(() => {
    setPage(1);
    if (selectedDate === queryDate) {
      void loadData();
      return;
    }
    setQueryDate(selectedDate);
  }, [loadData, queryDate, selectedDate]);

  const resetDate = useCallback(() => {
    const today = getLocalDateValue();
    setSelectedDate(today);
    setPage(1);
    if (queryDate === today) {
      void loadData();
      return;
    }
    setQueryDate(today);
  }, [loadData, queryDate]);

  const changePageSize = useCallback((nextPageSize: number) => {
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  return (
    <SchedulesPanel
      schedules={data.schedules}
      listLoading={listLoading}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      page={page}
      pageSize={pageSize}
      onSearch={search}
      onReset={resetDate}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
    />
  );
}
