"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { toAssessmentReportDateBoundary } from "@/lib/assessmentReport";
import { AssessmentShareStatsPanel } from "@/panels/AssessmentShareStatsPanel";
import { AssessmentReportsPanel } from "@/panels/AssessmentReportsPanel";
import {
  fetchAssessmentReportDetail,
  fetchAssessmentReports,
  fetchPatientAssessmentReports,
} from "@/services/assessmentReports";
import { fetchAssessmentShareStats } from "@/services/assessmentShareStats";
import type {
  AssessmentReportDetail,
  AssessmentReportListFilters,
  AssessmentReportListItem,
} from "@/types/assessmentReport";
import type {
  AssessmentShareStats,
  AssessmentShareStatsFilters,
} from "@/types/assessmentShareStats";

type AssessmentDataView = "reports" | "share-stats";

function getInitialFilters(assessmentId: string): AssessmentReportListFilters {
  return {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    keyword: "",
    assessmentId,
    category: "",
    source: "",
    startAt: "",
    endAt: "",
  };
}

function normalizedFilters(
  filters: AssessmentReportListFilters,
): AssessmentReportListFilters {
  return {
    ...filters,
    keyword: filters.keyword?.trim() || "",
    assessmentId: filters.assessmentId?.trim() || "",
  };
}

function isSameQuery(
  first: AssessmentReportListFilters,
  second: AssessmentReportListFilters,
) {
  return (
    first.page === second.page &&
    first.pageSize === second.pageSize &&
    (first.keyword || "") === (second.keyword || "") &&
    (first.assessmentId || "") === (second.assessmentId || "") &&
    (first.category || "") === (second.category || "") &&
    (first.source || "") === (second.source || "") &&
    (first.startAt || "") === (second.startAt || "") &&
    (first.endAt || "") === (second.endAt || "")
  );
}

function positiveInteger(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function AssessmentReportsScreen() {
  return (
    <AppRoute sectionId="assessmentReports">
      <AssessmentReportsRouteContent />
    </AppRoute>
  );
}

function AssessmentReportsRouteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAssessmentId = searchParams.get("assessmentId")?.trim() || "";
  const accountId = positiveInteger(searchParams.get("accountId"));
  const activeView: AssessmentDataView =
    !accountId && searchParams.get("view") === "share-stats"
      ? "share-stats"
      : "reports";
  const scopeKey = `${accountId || "all"}:${initialAssessmentId}:${activeView}`;

  const changeView = useCallback(
    (view: AssessmentDataView) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (view === "share-stats") {
        nextParams.set("view", "share-stats");
      } else {
        nextParams.delete("view");
      }
      const query = nextParams.toString();
      router.replace(`/assessment-reports${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  return (
    <>
      {!accountId && (
        <AssessmentDataViewTabs
          activeView={activeView}
          onChange={changeView}
        />
      )}
      {activeView === "share-stats" ? (
        <AssessmentShareStatsScreenContent
          initialAssessmentId={initialAssessmentId}
          key={scopeKey}
        />
      ) : (
        <AssessmentReportsScreenContent
          accountId={accountId}
          initialAssessmentId={initialAssessmentId}
          key={scopeKey}
        />
      )}
    </>
  );
}

function AssessmentDataViewTabs({
  activeView,
  onChange,
}: {
  activeView: AssessmentDataView;
  onChange: (view: AssessmentDataView) => void;
}) {
  const tabs: Array<{ id: AssessmentDataView; label: string }> = [
    { id: "reports", label: "填写记录" },
    { id: "share-stats", label: "分享统计" },
  ];

  return (
    <nav
      aria-label="量表数据视图"
      className="mb-4 flex flex-wrap gap-2 rounded-xl border border-[var(--lxxl-border)] bg-white p-2"
    >
      {tabs.map((tab) => {
        const active = activeView === tab.id;
        return (
          <button
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-[var(--lxxl-green)] text-white"
                : "text-[var(--lxxl-muted)] hover:bg-[#FAF8F4] hover:text-[var(--lxxl-green-dark)]"
            }`}
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

function getInitialShareStatsFilters(
  assessmentId: string,
): AssessmentShareStatsFilters {
  return {
    assessmentId,
    startAt: "",
    endAt: "",
  };
}

function normalizeShareStatsFilters(
  filters: AssessmentShareStatsFilters,
): AssessmentShareStatsFilters {
  return {
    ...filters,
    assessmentId: filters.assessmentId?.trim() || "",
  };
}

function isSameShareStatsQuery(
  first: AssessmentShareStatsFilters,
  second: AssessmentShareStatsFilters,
) {
  return (
    (first.assessmentId || "") === (second.assessmentId || "") &&
    (first.startAt || "") === (second.startAt || "") &&
    (first.endAt || "") === (second.endAt || "")
  );
}

function shareStatsQueryKey(filters: AssessmentShareStatsFilters) {
  return JSON.stringify([
    filters.assessmentId?.trim() || "",
    filters.startAt || "",
    filters.endAt || "",
  ]);
}

function AssessmentShareStatsScreenContent({
  initialAssessmentId,
}: {
  initialAssessmentId: string;
}) {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [draftFilters, setDraftFilters] =
    useState<AssessmentShareStatsFilters>(() =>
      getInitialShareStatsFilters(initialAssessmentId),
    );
  const [queryFilters, setQueryFilters] =
    useState<AssessmentShareStatsFilters>(() =>
      getInitialShareStatsFilters(initialAssessmentId),
    );
  const [stats, setStats] = useState<AssessmentShareStats>();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const requestSequence = useRef(0);
  const loadedQueryKey = useRef<string | undefined>(undefined);
  const inFlightQuery = useRef<
    { key: string; sequence: number } | undefined
  >(undefined);

  const loadStats = useCallback(async () => {
    const currentQueryKey = shareStatsQueryKey(queryFilters);
    if (
      inFlightQuery.current?.key === currentQueryKey &&
      inFlightQuery.current.sequence === requestSequence.current
    ) {
      return false;
    }
    const currentSequence = ++requestSequence.current;
    inFlightQuery.current = {
      key: currentQueryKey,
      sequence: currentSequence,
    };
    if (loadedQueryKey.current !== currentQueryKey) {
      setStats(undefined);
    }
    setLoading(true);
    setLoadError(undefined);
    clearNotice();
    try {
      const result = await fetchAssessmentShareStats({
        ...queryFilters,
        startAt: toAssessmentReportDateBoundary(
          queryFilters.startAt,
          "start",
        ),
        endAt: toAssessmentReportDateBoundary(queryFilters.endAt, "end"),
      });
      if (requestSequence.current !== currentSequence) {
        return false;
      }
      setStats(result);
      loadedQueryKey.current = currentQueryKey;
      return true;
    } catch (error) {
      if (requestSequence.current === currentSequence) {
        const baseMessage =
          error instanceof Error ? error.message : "分享统计加载失败";
        const message =
          loadedQueryKey.current === currentQueryKey
            ? `${baseMessage}，当前展示上次成功结果。`
            : baseMessage;
        setLoadError(message);
        showNotice(
          "error",
          message,
        );
      }
      return false;
    } finally {
      if (
        inFlightQuery.current?.key === currentQueryKey &&
        inFlightQuery.current.sequence === currentSequence
      ) {
        inFlightQuery.current = undefined;
      }
      if (requestSequence.current === currentSequence) {
        setLoading(false);
      }
    }
  }, [clearNotice, queryFilters, showNotice]);

  useEffect(() => {
    void loadStats();
  }, [loadStats, refreshKey]);

  useEffect(
    () => () => {
      requestSequence.current += 1;
    },
    [],
  );

  const search = useCallback(() => {
    const nextFilters = normalizeShareStatsFilters(draftFilters);
    if (
      nextFilters.startAt &&
      nextFilters.endAt &&
      nextFilters.startAt > nextFilters.endAt
    ) {
      showNotice("error", "开始日期不能晚于结束日期");
      return;
    }
    setDraftFilters(nextFilters);
    if (isSameShareStatsQuery(nextFilters, queryFilters)) {
      void loadStats();
      return;
    }
    setQueryFilters(nextFilters);
  }, [draftFilters, loadStats, queryFilters, showNotice]);

  const reset = useCallback(() => {
    const nextFilters = getInitialShareStatsFilters(initialAssessmentId);
    setDraftFilters(nextFilters);
    if (isSameShareStatsQuery(nextFilters, queryFilters)) {
      void loadStats();
      return;
    }
    setQueryFilters(nextFilters);
  }, [initialAssessmentId, loadStats, queryFilters]);

  return (
    <AssessmentShareStatsPanel
      draftFilters={draftFilters}
      error={loadError}
      loading={loading}
      setDraftFilters={setDraftFilters}
      stats={stats}
      onReset={reset}
      onSearch={search}
    />
  );
}

function AssessmentReportsScreenContent({
  accountId,
  initialAssessmentId,
}: {
  accountId: number | null;
  initialAssessmentId: string;
}) {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [draftFilters, setDraftFilters] = useState<AssessmentReportListFilters>(
    () => getInitialFilters(initialAssessmentId),
  );
  const [queryFilters, setQueryFilters] = useState<AssessmentReportListFilters>(
    () => getInitialFilters(initialAssessmentId),
  );
  const [items, setItems] = useState<AssessmentReportListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTarget, setDetailTarget] =
    useState<AssessmentReportListItem>();
  const [selectedDetail, setSelectedDetail] =
    useState<AssessmentReportDetail>();
  const listRequestSequence = useRef(0);
  const detailRequestSequence = useRef(0);

  const loadList = useCallback(
    async (showLoadError = true) => {
      const requestSequence = ++listRequestSequence.current;
      setListLoading(true);
      clearNotice();
      try {
        const result = accountId
          ? await fetchPatientAssessmentReports(accountId, {
              page: queryFilters.page,
              pageSize: queryFilters.pageSize,
              source: queryFilters.source,
            })
          : await fetchAssessmentReports({
              ...queryFilters,
              startAt: toAssessmentReportDateBoundary(
                queryFilters.startAt,
                "start",
              ),
              endAt: toAssessmentReportDateBoundary(queryFilters.endAt, "end"),
            });
        if (requestSequence !== listRequestSequence.current) {
          return false;
        }
        setItems(result.items);
        setTotal(result.total);
        return true;
      } catch (error) {
        if (
          requestSequence === listRequestSequence.current &&
          showLoadError
        ) {
          showNotice(
            "error",
            error instanceof Error ? error.message : "量表报告加载失败",
          );
        }
        return false;
      } finally {
        if (requestSequence === listRequestSequence.current) {
          setListLoading(false);
        }
      }
    },
    [accountId, clearNotice, queryFilters, showNotice],
  );

  useEffect(() => {
    void loadList();
  }, [loadList, refreshKey]);

  const search = useCallback(() => {
    const nextFilters = normalizedFilters({
      ...draftFilters,
      page: 1,
      pageSize: queryFilters.pageSize,
    });
    if (
      nextFilters.startAt &&
      nextFilters.endAt &&
      nextFilters.startAt > nextFilters.endAt
    ) {
      showNotice("error", "开始日期不能晚于结束日期");
      return;
    }
    setDraftFilters(nextFilters);
    if (isSameQuery(nextFilters, queryFilters)) {
      void loadList();
      return;
    }
    setQueryFilters(nextFilters);
  }, [draftFilters, loadList, queryFilters, showNotice]);

  const reset = useCallback(() => {
    const nextFilters = getInitialFilters(initialAssessmentId);
    nextFilters.pageSize = queryFilters.pageSize;
    setDraftFilters(nextFilters);
    if (isSameQuery(nextFilters, queryFilters)) {
      void loadList();
      return;
    }
    setQueryFilters(nextFilters);
  }, [initialAssessmentId, loadList, queryFilters]);

  const changePage = useCallback((page: number) => {
    const nextPage = Math.max(1, page);
    setDraftFilters((current) => ({ ...current, page: nextPage }));
    setQueryFilters((current) => ({ ...current, page: nextPage }));
  }, []);

  const changePageSize = useCallback((pageSize: number) => {
    setDraftFilters((current) => ({ ...current, page: 1, pageSize }));
    setQueryFilters((current) => ({ ...current, page: 1, pageSize }));
  }, []);

  const closeDetail = useCallback(() => {
    detailRequestSequence.current += 1;
    setDetailLoading(false);
    setDetailTarget(undefined);
    setSelectedDetail(undefined);
  }, []);

  const openDetail = useCallback(
    async (item: AssessmentReportListItem) => {
      const requestSequence = ++detailRequestSequence.current;
      clearNotice();
      setDetailTarget(item);
      setSelectedDetail(undefined);
      setDetailLoading(true);
      try {
        const detail = await fetchAssessmentReportDetail(
          item.source,
          item.reportId,
        );
        if (requestSequence !== detailRequestSequence.current) {
          return;
        }
        setSelectedDetail(detail);
      } catch (error) {
        if (requestSequence !== detailRequestSequence.current) {
          return;
        }
        setDetailTarget(undefined);
        showNotice(
          "error",
          error instanceof Error ? error.message : "量表报告详情加载失败",
        );
      } finally {
        if (requestSequence === detailRequestSequence.current) {
          setDetailLoading(false);
        }
      }
    },
    [clearNotice, showNotice],
  );

  return (
    <AssessmentReportsPanel
      accountId={accountId}
      detailLoading={detailLoading}
      detailTarget={detailTarget}
      draftFilters={draftFilters}
      items={items}
      listLoading={listLoading}
      page={queryFilters.page}
      pageSize={queryFilters.pageSize}
      selectedDetail={selectedDetail}
      setDraftFilters={setDraftFilters}
      total={total}
      onCloseDetail={closeDetail}
      onOpenDetail={openDetail}
      onPageChange={changePage}
      onPageSizeChange={changePageSize}
      onReset={reset}
      onSearch={search}
    />
  );
}
