"use client";

import { useCallback, useEffect, useState } from "react";

import { approveRefundExemption, fetchRefundExemptions, rejectRefundExemption } from "@/services/refunds";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { RefundsPanel } from "@/panels/RefundsPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { ScreenData } from "@/types/app";

export function RefundsScreen() {
  return (
    <AppRoute sectionId="refunds">
      <RefundsScreenContent />
    </AppRoute>
  );
}

function RefundsScreenContent() {
  const { clearNotice, refreshKey, runAction, setLoading, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [status, setStatus] = useState("ALL");
  const [queryStatus, setQueryStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const loadData = useCallback(async () => {
    setLoading(true);
    clearNotice();
    try {
      const refunds = await fetchRefundExemptions(queryStatus as "ALL" | "PENDING" | "APPROVED" | "REJECTED");
      setData((prev) => ({ ...prev, refunds }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "豁免审核加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearNotice, queryStatus, setLoading, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const search = useCallback(() => {
    setPage(1);
    if (status === queryStatus) {
      void loadData();
      return;
    }
    setQueryStatus(status);
  }, [loadData, queryStatus, status]);

  return (
    <RefundsPanel
      refunds={data.refunds}
      page={page}
      pageSize={pageSize}
      status={status}
      setStatus={setStatus}
      onSearch={search}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPage(1);
        setPageSize(nextPageSize);
      }}
      onApprove={(id) => runAction(() => approveRefundExemption(id), "已通过豁免申请")}
      onReject={(id, reason) => runAction(() => rejectRefundExemption(id, reason), "已拒绝豁免申请")}
    />
  );
}
