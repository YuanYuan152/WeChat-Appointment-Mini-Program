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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const loadData = useCallback(async () => {
    setLoading(true);
    clearNotice();
    try {
      const refunds = await fetchRefundExemptions("ALL");
      setData((prev) => ({ ...prev, refunds }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "豁免审核加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearNotice, setLoading, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  return (
    <RefundsPanel
      refunds={data.refunds}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPage(1);
        setPageSize(nextPageSize);
      }}
      onApprove={(id) => runAction(() => approveRefundExemption(id), "已通过豁免申请")}
      onReject={(id) => {
        const reason = window.prompt("请输入拒绝原因");
        if (!reason) {
          return;
        }
        void runAction(() => rejectRefundExemption(id, reason), "已拒绝豁免申请");
      }}
    />
  );
}
