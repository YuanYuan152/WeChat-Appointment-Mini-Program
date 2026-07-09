"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { CounselorDashboardPanel } from "@/panels/CounselorDashboardPanel";
import {
  fetchCounselorDashboard,
  type CounselorDashboardCategory,
  type CounselorDashboardPeriod,
} from "@/services/counselor";
import type { ScreenData } from "@/types/app";

const INITIAL_PERIOD: CounselorDashboardPeriod = "month";

export function CounselorDashboardScreen() {
  return (
    <AppRoute sectionId="counselorDashboard">
      <CounselorDashboardScreenContent />
    </AppRoute>
  );
}

function CounselorDashboardScreenContent() {
  const router = useRouter();
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [period, setPeriod] = useState<CounselorDashboardPeriod>(INITIAL_PERIOD);
  const [draftPeriod, setDraftPeriod] = useState<CounselorDashboardPeriod>(INITIAL_PERIOD);
  const [listLoading, setListLoading] = useState(false);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const counselorDashboard = await fetchCounselorDashboard(period);
      setData((prev) => ({ ...prev, counselorDashboard }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "个人看板加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, period, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const search = useCallback(() => {
    if (period === draftPeriod) {
      void loadData();
      return;
    }
    setPeriod(draftPeriod);
  }, [draftPeriod, loadData, period]);

  const reset = useCallback(() => {
    setDraftPeriod(INITIAL_PERIOD);
    if (period === INITIAL_PERIOD) {
      void loadData();
      return;
    }
    setPeriod(INITIAL_PERIOD);
  }, [loadData, period]);

  const openCategory = useCallback(
    (category: CounselorDashboardCategory) => {
      const params = new URLSearchParams({ period });
      if (category === "orders") {
        router.push(`/counselor-order-details?${params.toString()}`);
        return;
      }
      params.set("tab", category === "appointments" ? "appointments" : "case-records");
      router.push(`/counselor-consultation-details?${params.toString()}`);
    },
    [period, router],
  );

  return (
    <CounselorDashboardPanel
      stats={data.counselorDashboard}
      listLoading={listLoading}
      period={draftPeriod}
      setPeriod={setDraftPeriod}
      onSearch={search}
      onReset={reset}
      onOpenCategory={openCategory}
    />
  );
}
