"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { getMessage } from "@/lib/display";
import { ReviewsPanel } from "@/panels/ReviewsPanel";
import type { ReviewCategory, ReviewItem } from "@/panels/ReviewsPanel";
import {
  approveLeaveRequest,
  fetchLeaveRequest,
  fetchLeaveRequests,
  rejectLeaveRequest,
} from "@/services/reviews";
import type { ReviewStatus } from "@/services/reviews";
import {
  approveRefundExemption,
  fetchRefundExemptions,
  rejectRefundExemption,
} from "@/services/refunds";

export function ReviewsScreen() {
  return (
    <AppRoute sectionId="refunds">
      <ReviewsScreenContent />
    </AppRoute>
  );
}

function ReviewsScreenContent() {
  const searchParams = useSearchParams();
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const categoryParam = searchParams.get("category");
  const statusParam = searchParams.get("status");
  const exemptionIdParam = searchParams.get("exemptionId");
  const leaveIdParam = searchParams.get("leaveId") || searchParams.get("id");
  const exemptionId = positiveNumber(exemptionIdParam);
  const leaveId = positiveNumber(leaveIdParam);
  const deepLinkKey = exemptionId || leaveId
    ? [categoryParam || "", statusParam || "", exemptionId || "", leaveId || ""].join(":")
    : null;
  const [category, setCategory] = useState<ReviewCategory>(() =>
    initialCategory(categoryParam, exemptionId, leaveId),
  );
  const [status, setStatus] = useState<ReviewStatus>(() => initialStatus(statusParam));
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const deepLinkHandled = useRef<string | null>(null);
  const loadRequestId = useRef(0);

  useEffect(() => {
    deepLinkHandled.current = null;
    setCategory(initialCategory(categoryParam, exemptionId, leaveId));
    setStatus(initialStatus(statusParam));
    setSelectedItem(null);
    setPage(1);
  }, [categoryParam, exemptionId, leaveId, statusParam]);

  const loadData = useCallback(async () => {
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    setListLoading(true);
    clearNotice();
    try {
      const needExemptions = category === "ALL" || category === "EXEMPTION";
      const needLeaves = category === "ALL" || category === "LEAVE";
      const [exemptions, leaves] = await Promise.all([
        needExemptions ? fetchRefundExemptions(status) : Promise.resolve([]),
        needLeaves ? fetchLeaveRequests(status) : Promise.resolve([]),
      ]);
      const nextItems: ReviewItem[] = [
        ...exemptions.map((data) => ({ kind: "EXEMPTION" as const, id: data.id, data })),
        ...leaves.map((data) => ({ kind: "LEAVE" as const, id: data.id, data })),
      ].sort((left, right) => timestamp(right.data.createdAt) - timestamp(left.data.createdAt));
      if (requestId !== loadRequestId.current) {
        return;
      }
      setItems(nextItems);

      if (deepLinkKey && deepLinkHandled.current !== deepLinkKey) {
        deepLinkHandled.current = deepLinkKey;
        const matchingItem = nextItems.find(
          (item) =>
            (item.kind === "EXEMPTION" && item.id === exemptionId) ||
            (item.kind === "LEAVE" && item.id === leaveId),
        );
        if (matchingItem) {
          setSelectedItem(matchingItem);
        } else if (leaveId) {
          const detail = await fetchLeaveRequest(leaveId);
          if (requestId === loadRequestId.current) {
            setSelectedItem({ kind: "LEAVE", id: detail.id, data: detail });
          }
        } else if (exemptionId) {
          const allExemptions = status === "ALL" ? exemptions : await fetchRefundExemptions("ALL");
          const exemption = allExemptions.find((item) => item.id === exemptionId);
          if (exemption && requestId === loadRequestId.current) {
            setSelectedItem({ kind: "EXEMPTION", id: exemption.id, data: exemption });
          }
        }
      }
    } catch (error) {
      if (requestId === loadRequestId.current) {
        setItems([]);
        showNotice("error", error instanceof Error ? error.message : "审核记录加载失败");
      }
    } finally {
      if (requestId === loadRequestId.current) {
        setListLoading(false);
      }
    }
  }, [category, clearNotice, deepLinkKey, exemptionId, leaveId, showNotice, status]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const refreshAfterAction = useCallback(async () => {
    setSelectedItem(null);
    await loadData();
  }, [loadData]);

  const approve = useCallback(
    async (item: ReviewItem) => {
      setProcessing(true);
      clearNotice();
      try {
        const result =
          item.kind === "EXEMPTION"
            ? await approveRefundExemption(item.id)
            : await approveLeaveRequest(item.id);
        showNotice(
          "success",
          getMessage(result, item.kind === "EXEMPTION" ? "已同意豁免" : "已通过请假申请"),
        );
        await refreshAfterAction();
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "审核操作失败");
      } finally {
        setProcessing(false);
      }
    },
    [clearNotice, refreshAfterAction, showNotice],
  );

  const rejectExemption = useCallback(
    async (item: Extract<ReviewItem, { kind: "EXEMPTION" }>, reason: string) => {
      setProcessing(true);
      clearNotice();
      try {
        const result = await rejectRefundExemption(item.id, reason);
        showNotice("success", getMessage(result, "已拒绝豁免申请"));
        await refreshAfterAction();
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "拒绝豁免申请失败");
      } finally {
        setProcessing(false);
      }
    },
    [clearNotice, refreshAfterAction, showNotice],
  );

  const rejectLeave = useCallback(
    async (item: Extract<ReviewItem, { kind: "LEAVE" }>, reason: string) => {
      setProcessing(true);
      clearNotice();
      try {
        const result = await rejectLeaveRequest(item.id, reason);
        showNotice("success", getMessage(result, "已拒绝请假申请"));
        await refreshAfterAction();
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "拒绝请假申请失败");
      } finally {
        setProcessing(false);
      }
    },
    [clearNotice, refreshAfterAction, showNotice],
  );

  return (
    <ReviewsPanel
      items={items}
      category={category}
      status={status}
      page={page}
      pageSize={pageSize}
      listLoading={listLoading}
      processing={processing}
      selectedItem={selectedItem}
      onCategoryChange={(nextCategory) => {
        setCategory(nextCategory);
        setSelectedItem(null);
        setPage(1);
      }}
      onStatusChange={(nextStatus) => {
        setStatus(nextStatus);
        setSelectedItem(null);
        setPage(1);
      }}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPageSize(nextPageSize);
        setPage(1);
      }}
      onOpen={setSelectedItem}
      onClose={() => setSelectedItem(null)}
      onApprove={approve}
      onRejectExemption={rejectExemption}
      onRejectLeave={rejectLeave}
    />
  );
}

function initialCategory(value: string | null, exemptionId: number | null, leaveId: number | null): ReviewCategory {
  const normalized = value?.toUpperCase();
  if (normalized === "ALL" || normalized === "EXEMPTION" || normalized === "LEAVE") {
    return normalized;
  }
  if (leaveId) return "LEAVE";
  if (exemptionId) return "EXEMPTION";
  return "ALL";
}

function initialStatus(value: string | null): ReviewStatus {
  const normalized = value?.toUpperCase();
  if (normalized === "ALL" || normalized === "PENDING" || normalized === "APPROVED" || normalized === "REJECTED") {
    return normalized;
  }
  return "PENDING";
}

function positiveNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function timestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
