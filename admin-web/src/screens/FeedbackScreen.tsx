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
  const { clearNotice, refreshKey, setLoading, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [status, setStatus] = useState("ALL");
  const [queryStatus, setQueryStatus] = useState("ALL");

  const loadData = useCallback(async () => {
    setLoading(true);
    clearNotice();
    try {
      const feedbacks = await fetchFeedbacks(queryStatus);
      setData((prev) => ({ ...prev, feedbacks }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "用户反馈加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearNotice, queryStatus, setLoading, showNotice]);

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

  return <FeedbackPanel feedbacks={data.feedbacks} status={status} setStatus={setStatus} onSearch={search} />;
}
