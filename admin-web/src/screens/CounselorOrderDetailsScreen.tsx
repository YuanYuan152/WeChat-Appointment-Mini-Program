"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { CounselorOrderDetailsPanel } from "@/panels/CounselorOrderDetailsPanel";
import {
  fetchCounselorDashboardDetails,
  type CounselorDashboardPeriod,
} from "@/services/counselor";
import type { ScreenData } from "@/types/app";

const DEFAULT_PERIOD: CounselorDashboardPeriod = "month";
const PERIODS = new Set<CounselorDashboardPeriod>(["month", "quarter", "half_year", "all"]);

export function CounselorOrderDetailsScreen() {
  return (
    <AppRoute sectionId="counselorOrderDetails">
      <CounselorOrderDetailsScreenContent />
    </AppRoute>
  );
}

function CounselorOrderDetailsScreenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPeriod = useMemo(
    () => parsePeriod(searchParams.get("period")),
    [searchParams],
  );
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [period, setPeriod] = useState<CounselorDashboardPeriod>(initialPeriod);
  const [draftPeriod, setDraftPeriod] = useState<CounselorDashboardPeriod>(initialPeriod);
  const [listLoading, setListLoading] = useState(false);

  const syncUrl = useCallback(
    (nextPeriod: CounselorDashboardPeriod) => {
      const params = new URLSearchParams({ period: nextPeriod });
      router.replace(`/counselor-order-details?${params.toString()}`);
    },
    [router],
  );

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const counselorDashboardDetails = await fetchCounselorDashboardDetails("orders", period);
      setData((prev) => ({ ...prev, counselorDashboardDetails }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "订单明细加载失败");
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
    syncUrl(draftPeriod);
  }, [draftPeriod, loadData, period, syncUrl]);

  const reset = useCallback(() => {
    setDraftPeriod(DEFAULT_PERIOD);
    if (period === DEFAULT_PERIOD) {
      void loadData();
      syncUrl(DEFAULT_PERIOD);
      return;
    }
    setPeriod(DEFAULT_PERIOD);
    syncUrl(DEFAULT_PERIOD);
  }, [loadData, period, syncUrl]);

  return (
    <CounselorOrderDetailsPanel
      details={data.counselorDashboardDetails}
      listLoading={listLoading}
      period={draftPeriod}
      setPeriod={setDraftPeriod}
      onSearch={search}
      onReset={reset}
    />
  );
}

function parsePeriod(value: string | null): CounselorDashboardPeriod {
  return value && PERIODS.has(value as CounselorDashboardPeriod)
    ? (value as CounselorDashboardPeriod)
    : DEFAULT_PERIOD;
}
