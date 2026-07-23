"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { toAssessmentReportDateBoundary } from "@/lib/assessmentReport";
import { AssessmentReportsPanel } from "@/panels/AssessmentReportsPanel";
import {
  fetchAssessmentReportDetail,
  fetchAssessmentReports,
  fetchPatientAssessmentReports,
} from "@/services/assessmentReports";
import type {
  AssessmentReportDetail,
  AssessmentReportListFilters,
  AssessmentReportListItem,
} from "@/types/assessmentReport";

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
  const searchParams = useSearchParams();
  const initialAssessmentId = searchParams.get("assessmentId")?.trim() || "";
  const accountId = positiveInteger(searchParams.get("accountId"));
  const scopeKey = `${accountId || "all"}:${initialAssessmentId}`;

  return (
    <AssessmentReportsScreenContent
      accountId={accountId}
      initialAssessmentId={initialAssessmentId}
      key={scopeKey}
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
