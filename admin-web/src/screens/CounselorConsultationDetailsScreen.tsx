"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import {
  CounselorConsultationDetailsPanel,
  type CounselorConsultationDetailTab,
} from "@/panels/CounselorConsultationDetailsPanel";
import {
  fetchCounselorDashboardDetails,
  type CounselorDashboardPeriod,
} from "@/services/counselor";
import type { CounselorDashboardDetailItem } from "@/types/api";

const DEFAULT_PERIOD: CounselorDashboardPeriod = "month";
const DEFAULT_TAB: CounselorConsultationDetailTab = "case-records";
const PERIODS = new Set<CounselorDashboardPeriod>(["month", "quarter", "half_year", "all"]);
const TABS = new Set<CounselorConsultationDetailTab>(["case-records", "appointments"]);

export function CounselorConsultationDetailsScreen() {
  return (
    <AppRoute sectionId="counselorConsultationDetails">
      <CounselorConsultationDetailsScreenContent />
    </AppRoute>
  );
}

function CounselorConsultationDetailsScreenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPeriod = useMemo(
    () => parsePeriod(searchParams.get("period")),
    [searchParams],
  );
  const initialTab = useMemo(
    () => parseTab(searchParams.get("tab")),
    [searchParams],
  );
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [caseRecordDetails, setCaseRecordDetails] = useState<CounselorDashboardDetailItem[]>();
  const [appointmentDetails, setAppointmentDetails] = useState<CounselorDashboardDetailItem[]>();
  const [period, setPeriod] = useState<CounselorDashboardPeriod>(initialPeriod);
  const [draftPeriod, setDraftPeriod] = useState<CounselorDashboardPeriod>(initialPeriod);
  const [activeTab, setActiveTab] = useState<CounselorConsultationDetailTab>(initialTab);
  const [listLoading, setListLoading] = useState(false);

  const syncUrl = useCallback(
    (nextPeriod: CounselorDashboardPeriod, nextTab: CounselorConsultationDetailTab) => {
      const params = new URLSearchParams({ period: nextPeriod, tab: nextTab });
      router.replace(`/counselor-consultation-details?${params.toString()}`);
    },
    [router],
  );

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const [nextCaseRecordDetails, nextAppointmentDetails] = await Promise.all([
        fetchCounselorDashboardDetails("case-records", period),
        fetchCounselorDashboardDetails("appointments", period),
      ]);
      setCaseRecordDetails(nextCaseRecordDetails);
      setAppointmentDetails(nextAppointmentDetails);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询明细加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, period, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const search = useCallback(() => {
    syncUrl(draftPeriod, activeTab);
    if (period === draftPeriod) {
      void loadData();
      return;
    }
    setPeriod(draftPeriod);
  }, [activeTab, draftPeriod, loadData, period, syncUrl]);

  const reset = useCallback(() => {
    setDraftPeriod(DEFAULT_PERIOD);
    syncUrl(DEFAULT_PERIOD, activeTab);
    if (period === DEFAULT_PERIOD) {
      void loadData();
      return;
    }
    setPeriod(DEFAULT_PERIOD);
  }, [activeTab, loadData, period, syncUrl]);

  const changeActiveTab = useCallback(
    (nextTab: CounselorConsultationDetailTab) => {
      setActiveTab(nextTab);
      syncUrl(period, nextTab);
    },
    [period, syncUrl],
  );

  return (
    <CounselorConsultationDetailsPanel
      activeTab={activeTab}
      appointmentDetails={appointmentDetails}
      caseRecordDetails={caseRecordDetails}
      listLoading={listLoading}
      period={draftPeriod}
      setActiveTab={changeActiveTab}
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

function parseTab(value: string | null): CounselorConsultationDetailTab {
  return value && TABS.has(value as CounselorConsultationDetailTab)
    ? (value as CounselorConsultationDetailTab)
    : DEFAULT_TAB;
}
