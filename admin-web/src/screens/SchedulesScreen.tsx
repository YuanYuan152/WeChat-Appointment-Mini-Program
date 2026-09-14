"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchScheduleOverview } from "@/services/schedules";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { SchedulesPanel } from "@/panels/SchedulesPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { ScreenData } from "@/types/app";

export function SchedulesScreen() {
  return (
    <AppRoute sectionId="schedules">
      <SchedulesScreenContent />
    </AppRoute>
  );
}

function SchedulesScreenContent() {
  const router = useRouter();
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [selectedKeyword, setSelectedKeyword] = useState("");
  const [queryKeyword, setQueryKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const schedules = await fetchScheduleOverview(queryKeyword);
      setData((prev) => ({ ...prev, schedules }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "排期情况加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, queryKeyword, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const search = useCallback(() => {
    setPage(1);
    const nextKeyword = selectedKeyword.trim();
    if (nextKeyword === queryKeyword) {
      void loadData();
      return;
    }
    setQueryKeyword(nextKeyword);
  }, [loadData, queryKeyword, selectedKeyword]);

  const reset = useCallback(() => {
    setSelectedKeyword("");
    setPage(1);
    if (!queryKeyword) {
      void loadData();
      return;
    }
    setQueryKeyword("");
  }, [loadData, queryKeyword]);

  const changePageSize = useCallback((nextPageSize: number) => {
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  return (
    <SchedulesPanel
      schedules={data.schedules}
      listLoading={listLoading}
      selectedKeyword={selectedKeyword}
      setSelectedKeyword={setSelectedKeyword}
      page={page}
      pageSize={pageSize}
      onSearch={search}
      onReset={reset}
      onViewCounselor={(counselor) => {
        const date = counselor.schedules[0]?.startTime?.slice(0, 10) || "";
        const params = new URLSearchParams({ name: counselor.counselorName });
        if (date) params.set("date", date);
        router.push(`/schedules/${counselor.counselorId}?${params.toString()}`);
      }}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
    />
  );
}
