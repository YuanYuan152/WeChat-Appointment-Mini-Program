"use client";

import { useCallback, useEffect, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { CounselorDashboardPanel } from "@/panels/CounselorDashboardPanel";
import {
  fetchCounselorDashboard,
  fetchCounselorDashboardDetails,
  type CounselorDashboardCategory,
  type CounselorDashboardPeriod,
} from "@/services/counselor";
import type { CounselorDashboardDetailItem } from "@/types/api";
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
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [period, setPeriod] = useState<CounselorDashboardPeriod>(INITIAL_PERIOD);
  const [draftPeriod, setDraftPeriod] = useState<CounselorDashboardPeriod>(INITIAL_PERIOD);
  const [listLoading, setListLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CounselorDashboardCategory>();
  const [details, setDetails] = useState<CounselorDashboardDetailItem[]>();
  const [detailLoading, setDetailLoading] = useState(false);

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
    setSelectedCategory(undefined);
    setDetails(undefined);
    if (period === draftPeriod) {
      void loadData();
      return;
    }
    setPeriod(draftPeriod);
  }, [draftPeriod, loadData, period]);

  const reset = useCallback(() => {
    setDraftPeriod(INITIAL_PERIOD);
    setSelectedCategory(undefined);
    setDetails(undefined);
    if (period === INITIAL_PERIOD) {
      void loadData();
      return;
    }
    setPeriod(INITIAL_PERIOD);
  }, [loadData, period]);

  const openCategory = useCallback(
    async (category: CounselorDashboardCategory) => {
      setSelectedCategory(category);
      setDetails(undefined);
      setDetailLoading(true);
      try {
        const counselorDashboardDetails = await fetchCounselorDashboardDetails(category, period);
        setDetails(counselorDashboardDetails);
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "看板明细加载失败");
      } finally {
        setDetailLoading(false);
      }
    },
    [period, showNotice],
  );

  const closeDetail = useCallback(() => {
    setSelectedCategory(undefined);
    setDetails(undefined);
    setDetailLoading(false);
  }, []);

  return (
    <CounselorDashboardPanel
      stats={data.counselorDashboard}
      details={details}
      listLoading={listLoading}
      detailLoading={detailLoading}
      period={draftPeriod}
      selectedCategory={selectedCategory}
      setPeriod={setDraftPeriod}
      onSearch={search}
      onReset={reset}
      onOpenCategory={openCategory}
      onCloseDetail={closeDetail}
    />
  );
}
