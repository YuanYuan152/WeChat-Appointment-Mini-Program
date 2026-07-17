"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { approveRefundExemption, fetchRefundExemptions, rejectRefundExemption } from "@/services/refunds";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { RefundsPanel } from "@/panels/RefundsPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { getMessage } from "@/lib/display";
import type { ScreenData } from "@/types/app";

export function RefundsScreen() {
  return (
    <AppRoute sectionId="refunds">
      <RefundsScreenContent />
    </AppRoute>
  );
}

function RefundsScreenContent() {
  const searchParams = useSearchParams();
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const focusedRefundId = numberFromSearchParam(searchParams.get("exemptionId"));
  const initialStatus = focusedRefundId ? "PENDING" : "ALL";
  const [data, setData] = useState<ScreenData>({});
  const [status, setStatus] = useState(initialStatus);
  const [queryStatus, setQueryStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const refunds = await fetchRefundExemptions(queryStatus as "ALL" | "PENDING" | "APPROVED" | "REJECTED");
      setData((prev) => ({ ...prev, refunds }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "用户豁免加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, queryStatus, showNotice]);

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

  const approve = useCallback(
    async (id: number) => {
      setListLoading(true);
      clearNotice();
      try {
        const result = await approveRefundExemption(id);
        const refunds = await fetchRefundExemptions(queryStatus as "ALL" | "PENDING" | "APPROVED" | "REJECTED");
        setData((prev) => ({ ...prev, refunds }));
        showNotice("success", getMessage(result, "已通过豁免申请"));
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "通过豁免申请失败");
      } finally {
        setListLoading(false);
      }
    },
    [clearNotice, queryStatus, showNotice],
  );

  const reject = useCallback(
    async (id: number, reason: string) => {
      setListLoading(true);
      clearNotice();
      try {
        const result = await rejectRefundExemption(id, reason);
        const refunds = await fetchRefundExemptions(queryStatus as "ALL" | "PENDING" | "APPROVED" | "REJECTED");
        setData((prev) => ({ ...prev, refunds }));
        showNotice("success", getMessage(result, "已拒绝豁免申请"));
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "拒绝豁免申请失败");
      } finally {
        setListLoading(false);
      }
    },
    [clearNotice, queryStatus, showNotice],
  );

  return (
    <RefundsPanel
      refunds={data.refunds}
      page={page}
      pageSize={pageSize}
      listLoading={listLoading}
      status={status}
      focusedRefundId={focusedRefundId}
      setStatus={setStatus}
      onSearch={search}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPage(1);
        setPageSize(nextPageSize);
      }}
      onApprove={approve}
      onReject={reject}
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
