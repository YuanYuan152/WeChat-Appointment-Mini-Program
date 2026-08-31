"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { SystemFeedbackPanel } from "@/panels/SystemFeedbackPanel";
import { fetchSystemFeedbacks, updateSystemFeedbackStatus } from "@/services/systemFeedback";
import type { FeedbackItem } from "@/types/api";
import type { ScreenData } from "@/types/app";

export function SystemFeedbackScreen() {
  return (
    <AppRoute sectionId="systemFeedback">
      <SystemFeedbackScreenContent />
    </AppRoute>
  );
}

function SystemFeedbackScreenContent() {
  const searchParams = useSearchParams();
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const focusedFeedbackId = numberFromSearchParam(searchParams.get("feedbackId"));
  const [data, setData] = useState<ScreenData>({});
  const [keyword, setKeyword] = useState("");
  const [queryKeyword, setQueryKeyword] = useState("");
  const [status, setStatus] = useState("ALL");
  const [queryStatus, setQueryStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [listLoading, setListLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const systemFeedbacks = await fetchSystemFeedbacks(queryStatus);
      setData((prev) => ({ ...prev, systemFeedbacks }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "系统反馈加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, queryStatus, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const search = useCallback(() => {
    setPage(1);
    if (status === queryStatus && keyword === queryKeyword) {
      void loadData();
      return;
    }
    setQueryKeyword(keyword);
    setQueryStatus(status);
  }, [keyword, loadData, queryKeyword, queryStatus, status]);

  const reset = useCallback(() => {
    setKeyword("");
    setQueryKeyword("");
    setStatus("ALL");
    setPage(1);
    if (queryStatus === "ALL") {
      void loadData();
      return;
    }
    setQueryStatus("ALL");
  }, [loadData, queryStatus]);

  const markStatus = useCallback(
    async (item: FeedbackItem, nextStatus: "OPEN" | "CLOSED") => {
      setUpdatingId(item.id);
      clearNotice();
      try {
        const updated = await updateSystemFeedbackStatus(item.id, nextStatus);
        setData((prev) => ({
          ...prev,
          systemFeedbacks: (prev.systemFeedbacks || []).map((row) =>
            row.id === updated.id ? { ...row, ...updated } : row,
          ),
        }));
        showNotice("success", nextStatus === "CLOSED" ? "已标记为已处理" : "已重新打开");
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "更新状态失败");
      } finally {
        setUpdatingId(null);
      }
    },
    [clearNotice, showNotice],
  );

  return (
    <SystemFeedbackPanel
      feedbacks={data.systemFeedbacks}
      listLoading={listLoading}
      keyword={keyword}
      setKeyword={setKeyword}
      queryKeyword={queryKeyword}
      status={status}
      setStatus={setStatus}
      page={page}
      pageSize={pageSize}
      focusedFeedbackId={focusedFeedbackId}
      updatingId={updatingId}
      onSearch={search}
      onReset={reset}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPageSize(nextPageSize);
        setPage(1);
      }}
      onMarkStatus={(item, nextStatus) => {
        void markStatus(item, nextStatus);
      }}
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
