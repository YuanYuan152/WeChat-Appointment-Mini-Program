"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchOperationRecords } from "@/services/records";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { OperationLogsPanel } from "@/panels/OperationLogsPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { ScreenData, OperationFilters } from "@/types/app";

const INITIAL_OPERATION_FILTERS: OperationFilters = {
  keyword: "",
  role: "",
  actionType: "",
  operatorId: "",
  startAt: "",
  endAt: "",
};

export function OperationLogsScreen() {
  return (
    <AppRoute sectionId="operationLogs">
      <OperationLogsScreenContent />
    </AppRoute>
  );
}

function OperationLogsScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState<OperationFilters>(INITIAL_OPERATION_FILTERS);
  const [draftFilters, setDraftFilters] = useState<OperationFilters>(INITIAL_OPERATION_FILTERS);
  const [listLoading, setListLoading] = useState(false);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const operationRecords = await fetchOperationRecords(filters, {
        page,
        pageSize,
      });
      setData((prev) => ({ ...prev, operationRecords }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "操作记录加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, filters, page, pageSize, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const search = useCallback(() => {
    setPage(1);
    if (page === 1 && areOperationFiltersEqual(filters, draftFilters)) {
      void loadData();
      return;
    }
    setFilters(draftFilters);
  }, [draftFilters, filters, loadData, page]);

  const resetFilters = useCallback(() => {
    setDraftFilters(INITIAL_OPERATION_FILTERS);
    setPage(1);
    if (page === 1 && areOperationFiltersEqual(filters, INITIAL_OPERATION_FILTERS)) {
      void loadData();
      return;
    }
    setFilters(INITIAL_OPERATION_FILTERS);
  }, [filters, loadData, page]);

  const changePageSize = useCallback((nextPageSize: number) => {
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  return (
    <OperationLogsPanel
      records={data.operationRecords}
      listLoading={listLoading}
      filters={draftFilters}
      setFilters={setDraftFilters}
      onSearch={search}
      onReset={resetFilters}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
    />
  );
}

function areOperationFiltersEqual(left: OperationFilters, right: OperationFilters) {
  return (
    left.keyword === right.keyword &&
    left.role === right.role &&
    left.actionType === right.actionType &&
    left.operatorId === right.operatorId &&
    left.startAt === right.startAt &&
    left.endAt === right.endAt
  );
}
