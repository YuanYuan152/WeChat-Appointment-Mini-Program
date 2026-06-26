"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchCaseRecordDetail, fetchCounselorRecordDetails, fetchCounselorRecordSummary } from "@/services/records";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { CaseRecordsPanel } from "@/panels/CaseRecordsPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { CounselorRecordSummary } from "@/types/api";
import type { ScreenData } from "@/types/app";

export function CaseRecordsScreen() {
  return (
    <AppRoute sectionId="caseRecords">
      <CaseRecordsScreenContent />
    </AppRoute>
  );
}

function CaseRecordsScreenContent() {
  const { clearNotice, refreshKey, setLoading, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [selectedCounselorName, setSelectedCounselorName] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const loadData = useCallback(async () => {
    setLoading(true);
    clearNotice();
    try {
      const counselorRecords = await fetchCounselorRecordSummary();
      setData((prev) => ({ ...prev, counselorRecords }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询记录加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearNotice, setLoading, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const openCounselor = useCallback(
    async (record: CounselorRecordSummary) => {
      setLoading(true);
      clearNotice();
      try {
        const selectedCounselorRecords = await fetchCounselorRecordDetails(record.counselorId);
        setSelectedCounselorName(record.counselorName);
        setData((prev) => ({ ...prev, selectedCounselorRecords, selectedCaseRecord: undefined }));
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "咨询记录明细加载失败");
      } finally {
        setLoading(false);
      }
    },
    [clearNotice, setLoading, showNotice],
  );

  const openCaseRecord = useCallback(
    async (recordId: number) => {
      setLoading(true);
      clearNotice();
      try {
        const selectedCaseRecord = await fetchCaseRecordDetail(recordId);
        setData((prev) => ({ ...prev, selectedCaseRecord }));
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "咨询记录详情加载失败");
      } finally {
        setLoading(false);
      }
    },
    [clearNotice, setLoading, showNotice],
  );

  const closeDetails = useCallback(() => {
    setSelectedCounselorName(null);
    setData((prev) => ({ ...prev, selectedCounselorRecords: undefined, selectedCaseRecord: undefined }));
  }, []);

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
      selectedRecords={data.selectedCounselorRecords}
      selectedCaseRecord={data.selectedCaseRecord}
      onOpenCounselor={openCounselor}
      onOpenCaseRecord={openCaseRecord}
      onCloseDetails={closeDetails}
    />
  );
}
