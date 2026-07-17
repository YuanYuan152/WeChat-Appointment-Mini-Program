"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { FeedbackPanel } from "@/panels/FeedbackPanel";
import { fetchFeedbacks } from "@/services/feedback";
import type { ScreenData } from "@/types/app";

export function FeedbackScreen() {
  return (
    <AppRoute sectionId="feedback">
      <FeedbackScreenContent />
    </AppRoute>
  );
}

function FeedbackScreenContent() {
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

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const feedbacks = await fetchFeedbacks(queryStatus);
      setData((prev) => ({ ...prev, feedbacks }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询反馈加载失败");
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

  return (
    <FeedbackPanel
      feedbacks={data.feedbacks}
      listLoading={listLoading}
      keyword={keyword}
      setKeyword={setKeyword}
      queryKeyword={queryKeyword}
      status={status}
      setStatus={setStatus}
      page={page}
      pageSize={pageSize}
      focusedFeedbackId={focusedFeedbackId}
      onSearch={search}
      onReset={reset}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPageSize(nextPageSize);
        setPage(1);
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
