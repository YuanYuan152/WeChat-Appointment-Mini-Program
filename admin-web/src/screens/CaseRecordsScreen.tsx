"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  fetchCaseRecordDetail,
  fetchCounselorRecordDetails,
  fetchCounselorRecordSummary,
  type CaseRecordPeriod,
} from "@/services/records";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { CaseRecordsPanel } from "@/panels/CaseRecordsPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { AdminCaseRecordDetail, AdminConsultationRecord, CounselorRecordSummary } from "@/types/api";

export function CaseRecordsScreen() {
  return (
    <AppRoute sectionId="caseRecords">
      <CaseRecordsScreenContent />
    </AppRoute>
  );
}

function CaseRecordsScreenContent() {
  const searchParams = useSearchParams();
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const focusedRecordId = numberFromSearchParam(searchParams.get("recordId"));
  const [records, setRecords] = useState<CounselorRecordSummary[]>();
  const [selectedCounselorName, setSelectedCounselorName] = useState<string | null>(null);
  const [selectedCounselorId, setSelectedCounselorId] = useState<number | null>(null);
  const [selectedCounselorRecords, setSelectedCounselorRecords] = useState<AdminConsultationRecord[]>();
  const [selectedCaseRecord, setSelectedCaseRecord] = useState<AdminCaseRecordDetail>();
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [selectedRecordsLoading, setSelectedRecordsLoading] = useState(false);
  const [caseRecordLoading, setCaseRecordLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [period, setPeriod] = useState<CaseRecordPeriod>("month");
  const [appliedPeriod, setAppliedPeriod] = useState<CaseRecordPeriod>("month");
  const [counselorKeyword, setCounselorKeyword] = useState("");
  const [appliedCounselorKeyword, setAppliedCounselorKeyword] = useState("");
  const openedRecordRef = useRef<number | null>(null);

  const loadData = useCallback(async () => {
    setRecordsLoading(true);
    clearNotice();
    try {
      setRecords(
        await fetchCounselorRecordSummary({
          period: appliedPeriod,
          keyword: appliedCounselorKeyword,
        }),
      );
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询记录加载失败");
    } finally {
      setRecordsLoading(false);
    }
  }, [appliedCounselorKeyword, appliedPeriod, clearNotice, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const applyRecordFilters = useCallback(() => {
    setPage(1);
    setAppliedPeriod(period);
    setAppliedCounselorKeyword(counselorKeyword.trim());
  }, [counselorKeyword, period]);

  const resetRecordFilters = useCallback(() => {
    setPeriod("month");
    setCounselorKeyword("");
    setPage(1);
    setAppliedPeriod("month");
    setAppliedCounselorKeyword("");
  }, []);

  const openCounselor = useCallback(
    async (record: CounselorRecordSummary) => {
      clearNotice();
      setSelectedCounselorName(record.counselorName);
      setSelectedCounselorId(record.counselorId);
      setSelectedCounselorRecords(undefined);
      setSelectedCaseRecord(undefined);
      setSelectedRecordsLoading(true);
      try {
        setSelectedCounselorRecords(
          await fetchCounselorRecordDetails(record.counselorId, { period: appliedPeriod }),
        );
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "咨询记录明细加载失败");
      } finally {
        setSelectedRecordsLoading(false);
      }
    },
    [appliedPeriod, clearNotice, showNotice],
  );

  // 时间筛选变更后，若明细抽屉已打开则按新区间刷新明细
  useEffect(() => {
    if (!selectedCounselorId || !selectedCounselorName || selectedCaseRecord) {
      return;
    }
    let active = true;
    setSelectedRecordsLoading(true);
    void fetchCounselorRecordDetails(selectedCounselorId, { period: appliedPeriod })
      .then((items) => {
        if (active) setSelectedCounselorRecords(items);
      })
      .catch((error) => {
        if (active) {
          showNotice("error", error instanceof Error ? error.message : "咨询记录明细加载失败");
        }
      })
      .finally(() => {
        if (active) setSelectedRecordsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appliedPeriod, selectedCaseRecord, selectedCounselorId, selectedCounselorName, showNotice]);

  const openCaseRecord = useCallback(
    async (recordId: number) => {
      clearNotice();
      setCaseRecordLoading(true);
      try {
        const detail = await fetchCaseRecordDetail(recordId);
        setSelectedCounselorName(detail.CounselorName || "咨询师");
        setSelectedCaseRecord(detail);
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "咨询记录详情加载失败");
      } finally {
        setCaseRecordLoading(false);
      }
    },
    [clearNotice, showNotice],
  );

  useEffect(() => {
    if (!focusedRecordId || openedRecordRef.current === focusedRecordId) {
      return;
    }
    openedRecordRef.current = focusedRecordId;
    void openCaseRecord(focusedRecordId);
  }, [focusedRecordId, openCaseRecord]);

  const closeDetails = useCallback(() => {
    setSelectedCounselorName(null);
    setSelectedCounselorId(null);
    setSelectedCounselorRecords(undefined);
    setSelectedCaseRecord(undefined);
    setSelectedRecordsLoading(false);
    setCaseRecordLoading(false);
  }, []);

  const backToRecordList = useCallback(() => {
    setSelectedCaseRecord(undefined);
  }, []);

  return (
    <CaseRecordsPanel
      records={records}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPage(1);
        setPageSize(nextPageSize);
      }}
      period={period}
      setPeriod={setPeriod}
      counselorKeyword={counselorKeyword}
      setCounselorKeyword={setCounselorKeyword}
      appliedPeriod={appliedPeriod}
      onApplyRecordFilters={applyRecordFilters}
      onResetRecordFilters={resetRecordFilters}
      selectedCounselorName={selectedCounselorName}
      selectedRecords={selectedCounselorRecords}
      selectedRecordsLoading={selectedRecordsLoading}
      selectedCaseRecord={selectedCaseRecord}
      caseRecordLoading={caseRecordLoading}
      recordsLoading={recordsLoading}
      onOpenCounselor={openCounselor}
      onOpenCaseRecord={openCaseRecord}
      onBackToRecordList={backToRecordList}
      onCloseDetails={closeDetails}
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
