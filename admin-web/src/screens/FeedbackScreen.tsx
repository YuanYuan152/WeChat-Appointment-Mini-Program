"use client";

import { useCallback, useEffect, useState } from "react";

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
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [status, setStatus] = useState("ALL");
  const [queryStatus, setQueryStatus] = useState("ALL");
  const [listLoading, setListLoading] = useState(false);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const feedbacks = await fetchFeedbacks(queryStatus);
      setData((prev) => ({ ...prev, feedbacks }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "用户反馈加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, queryStatus, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const search = useCallback(() => {
    if (status === queryStatus) {
      void loadData();
      return;
    }
    setQueryStatus(status);
  }, [loadData, queryStatus, status]);

  return (
    <FeedbackPanel
      feedbacks={data.feedbacks}
      listLoading={listLoading}
      status={status}
      setStatus={setStatus}
      onSearch={search}
    />
  );
}
