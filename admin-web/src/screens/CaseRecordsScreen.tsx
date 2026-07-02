"use client";

import { useCallback, useEffect, useState } from "react";

import {
  approveCaseRecordAmendment,
  fetchCaseRecordAmendments,
  fetchCaseRecordDetail,
  fetchCounselorRecordDetails,
  fetchCounselorRecordSummary,
  rejectCaseRecordAmendment,
} from "@/services/records";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { CaseRecordsPanel } from "@/panels/CaseRecordsPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { getMessage } from "@/lib/display";
import type { AdminCaseRecordDetail, AdminConsultationRecord, CounselorRecordSummary } from "@/types/api";
import type { ScreenData } from "@/types/app";

export function CaseRecordsScreen() {
  return (
    <AppRoute sectionId="caseRecords">
      <CaseRecordsScreenContent />
    </AppRoute>
  );
}

function CaseRecordsScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [selectedCounselorName, setSelectedCounselorName] = useState<string | null>(null);
  const [selectedCounselorRecords, setSelectedCounselorRecords] = useState<AdminConsultationRecord[]>();
  const [selectedCaseRecord, setSelectedCaseRecord] = useState<AdminCaseRecordDetail>();
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [amendmentsLoading, setAmendmentsLoading] = useState(false);
  const [selectedRecordsLoading, setSelectedRecordsLoading] = useState(false);
  const [caseRecordLoading, setCaseRecordLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [amendmentStatus, setAmendmentStatus] = useState("PENDING");
  const [appliedAmendmentStatus, setAppliedAmendmentStatus] = useState("PENDING");

  const loadData = useCallback(async () => {
    setRecordsLoading(true);
    setAmendmentsLoading(true);
    clearNotice();
    try {
      const counselorRecords = await fetchCounselorRecordSummary();
      const caseRecordAmendments = await fetchCaseRecordAmendments(appliedAmendmentStatus);
      setData((prev) => ({ ...prev, counselorRecords, caseRecordAmendments }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询记录加载失败");
    } finally {
      setRecordsLoading(false);
      setAmendmentsLoading(false);
    }
  }, [appliedAmendmentStatus, clearNotice, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const openCounselor = useCallback(
    async (record: CounselorRecordSummary) => {
      clearNotice();
      setSelectedCounselorName(record.counselorName);
      setSelectedCounselorRecords(undefined);
      setSelectedCaseRecord(undefined);
      setSelectedRecordsLoading(true);
      try {
        setSelectedCounselorRecords(await fetchCounselorRecordDetails(record.counselorId));
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "咨询记录明细加载失败");
      } finally {
        setSelectedRecordsLoading(false);
      }
    },
    [clearNotice, showNotice],
  );

  const openCaseRecord = useCallback(
    async (recordId: number) => {
      clearNotice();
      setCaseRecordLoading(true);
      try {
        setSelectedCaseRecord(await fetchCaseRecordDetail(recordId));
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "咨询记录详情加载失败");
      } finally {
        setCaseRecordLoading(false);
      }
    },
    [clearNotice, showNotice],
  );

  const closeDetails = useCallback(() => {
    setSelectedCounselorName(null);
    setSelectedCounselorRecords(undefined);
    setSelectedCaseRecord(undefined);
    setSelectedRecordsLoading(false);
    setCaseRecordLoading(false);
  }, []);

  const backToRecordList = useCallback(() => {
    setSelectedCaseRecord(undefined);
  }, []);

  const loadAmendments = useCallback(async () => {
    setAmendmentsLoading(true);
    clearNotice();
    try {
      const caseRecordAmendments = await fetchCaseRecordAmendments(amendmentStatus);
      setAppliedAmendmentStatus(amendmentStatus);
      setData((prev) => ({ ...prev, caseRecordAmendments }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "修改审核加载失败");
    } finally {
      setAmendmentsLoading(false);
    }
  }, [amendmentStatus, clearNotice, showNotice]);

  const approveAmendment = useCallback(
    async (amendmentId: number) => {
      setAmendmentsLoading(true);
      clearNotice();
      try {
        const result = await approveCaseRecordAmendment(amendmentId);
        showNotice("success", getMessage(result, "已通过修改申请"));
        await loadData();
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "通过修改申请失败");
      } finally {
        setAmendmentsLoading(false);
      }
    },
    [clearNotice, loadData, showNotice],
  );

  const rejectAmendment = useCallback(
    async (amendmentId: number, rejectReason: string) => {
      setAmendmentsLoading(true);
      clearNotice();
      try {
        const result = await rejectCaseRecordAmendment(amendmentId, rejectReason);
        showNotice("success", getMessage(result, "已驳回修改申请"));
        await loadData();
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "驳回修改申请失败");
      } finally {
        setAmendmentsLoading(false);
      }
    },
    [clearNotice, loadData, showNotice],
  );

  return (
    <CaseRecordsPanel
      records={data.counselorRecords}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPage(1);
        setPageSize(nextPageSize);
      }}
      selectedCounselorName={selectedCounselorName}
      selectedRecords={selectedCounselorRecords}
      selectedRecordsLoading={selectedRecordsLoading}
      selectedCaseRecord={selectedCaseRecord}
      caseRecordLoading={caseRecordLoading}
      amendments={data.caseRecordAmendments}
      amendmentsLoading={amendmentsLoading}
      recordsLoading={recordsLoading}
      amendmentStatus={amendmentStatus}
      setAmendmentStatus={setAmendmentStatus}
      onLoadAmendments={loadAmendments}
      onApproveAmendment={approveAmendment}
      onRejectAmendment={rejectAmendment}
      onOpenCounselor={openCounselor}
      onOpenCaseRecord={openCaseRecord}
      onBackToRecordList={backToRecordList}
      onCloseDetails={closeDetails}
    />
  );
}
