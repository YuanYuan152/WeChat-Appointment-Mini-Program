"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  approveCaseRecordAmendment,
  fetchCaseRecordAmendments,
  rejectCaseRecordAmendment,
  type CaseRecordPeriod,
} from "@/services/records";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { CaseRecordAmendmentsPanel } from "@/panels/CaseRecordAmendmentsPanel";
import { getMessage } from "@/lib/display";
import type { CaseRecordAmendment } from "@/types/api";

export function CaseRecordAmendmentsScreen() {
  return (
    <AppRoute sectionId="caseRecords">
      <CaseRecordAmendmentsScreenContent />
    </AppRoute>
  );
}

function CaseRecordAmendmentsScreenContent() {
  const searchParams = useSearchParams();
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const focusedAmendmentId = numberFromSearchParam(searchParams.get("amendmentId"));
  const initialAmendmentStatus = focusedAmendmentId ? "ALL" : "PENDING";
  const initialPeriod: CaseRecordPeriod = focusedAmendmentId ? "all" : "month";
  const [amendments, setAmendments] = useState<CaseRecordAmendment[]>();
  const [amendmentsLoading, setAmendmentsLoading] = useState(false);
  const [amendmentStatus, setAmendmentStatus] = useState(initialAmendmentStatus);
  const [appliedAmendmentStatus, setAppliedAmendmentStatus] = useState(initialAmendmentStatus);
  const [period, setPeriod] = useState<CaseRecordPeriod>(initialPeriod);
  const [appliedPeriod, setAppliedPeriod] = useState<CaseRecordPeriod>(initialPeriod);
  const [counselorKeyword, setCounselorKeyword] = useState("");
  const [appliedCounselorKeyword, setAppliedCounselorKeyword] = useState("");

  const loadAmendments = useCallback(async () => {
    setAmendmentsLoading(true);
    clearNotice();
    try {
      setAmendments(
        await fetchCaseRecordAmendments({
          status: appliedAmendmentStatus,
          keyword: appliedCounselorKeyword,
          period: appliedPeriod,
        }),
      );
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "修改审核加载失败");
    } finally {
      setAmendmentsLoading(false);
    }
  }, [appliedAmendmentStatus, appliedCounselorKeyword, appliedPeriod, clearNotice, showNotice]);

  useEffect(() => {
    void loadAmendments();
  }, [loadAmendments, refreshKey]);

  const applyFilters = useCallback(() => {
    setAppliedAmendmentStatus(amendmentStatus);
    setAppliedPeriod(period);
    setAppliedCounselorKeyword(counselorKeyword.trim());
  }, [amendmentStatus, counselorKeyword, period]);

  const resetFilters = useCallback(() => {
    setAmendmentStatus("PENDING");
    setPeriod("month");
    setCounselorKeyword("");
    setAppliedAmendmentStatus("PENDING");
    setAppliedPeriod("month");
    setAppliedCounselorKeyword("");
  }, []);

  const approveAmendment = useCallback(
    async (amendmentId: number) => {
      setAmendmentsLoading(true);
      clearNotice();
      try {
        const result = await approveCaseRecordAmendment(amendmentId);
        showNotice("success", getMessage(result, "已通过修改申请"));
        await loadAmendments();
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "通过修改申请失败");
      } finally {
        setAmendmentsLoading(false);
      }
    },
    [clearNotice, loadAmendments, showNotice],
  );

  const rejectAmendment = useCallback(
    async (amendmentId: number, rejectReason: string) => {
      setAmendmentsLoading(true);
      clearNotice();
      try {
        const result = await rejectCaseRecordAmendment(amendmentId, rejectReason);
        showNotice("success", getMessage(result, "已驳回修改申请"));
        await loadAmendments();
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "驳回修改申请失败");
      } finally {
        setAmendmentsLoading(false);
      }
    },
    [clearNotice, loadAmendments, showNotice],
  );

  return (
    <CaseRecordAmendmentsPanel
      amendments={amendments}
      amendmentsLoading={amendmentsLoading}
      focusedAmendmentId={focusedAmendmentId}
      amendmentStatus={amendmentStatus}
      setAmendmentStatus={setAmendmentStatus}
      period={period}
      setPeriod={setPeriod}
      counselorKeyword={counselorKeyword}
      setCounselorKeyword={setCounselorKeyword}
      onApplyFilters={applyFilters}
      onResetFilters={resetFilters}
      onApproveAmendment={approveAmendment}
      onRejectAmendment={rejectAmendment}
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
