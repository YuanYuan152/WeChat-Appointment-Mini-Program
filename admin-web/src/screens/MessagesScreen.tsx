"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { resolveMessageActionTarget } from "@/lib/messageNavigation";
import type { MessageActionTarget } from "@/lib/messageNavigation";
import { MessagesPanel } from "@/panels/MessagesPanel";
import type { MessageBusinessDetail } from "@/panels/MessagesPanel";
import type { MessageCategoryFilter } from "@/panels/MessagesPanel";
import type { MessageReadFilter } from "@/panels/MessagesPanel";
import {
  confirmOfflinePaymentReceipt,
  fetchMessageDetail,
  fetchMessageLeaveRequestDetail,
  fetchMessages,
  fetchTodayMessageDigest,
  fetchUnreadMessageCount,
  markMessageRead,
  MESSAGE_UNREAD_CHANGED_EVENT,
} from "@/services/messages";
import type { TodayDigest } from "@/panels/MessagesPanel";
import type { MessageItem } from "@/types/api";
import type { ScreenData } from "@/types/app";

export function MessagesScreen() {
  return (
    <AppRoute sectionId="messages">
      <MessagesScreenContent />
    </AppRoute>
  );
}

function MessagesScreenContent() {
  const router = useRouter();
  const { clearNotice, currentUser, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<MessageReadFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<MessageCategoryFilter>("ALL");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [appliedStatusFilter, setAppliedStatusFilter] = useState<MessageReadFilter>("ALL");
  const [appliedCategoryFilter, setAppliedCategoryFilter] = useState<MessageCategoryFilter>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [crisisUnreadCount, setCrisisUnreadCount] = useState<number | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [selectedBusinessDetail, setSelectedBusinessDetail] = useState<MessageBusinessDetail>(null);
  const [selectedActionTarget, setSelectedActionTarget] = useState<MessageActionTarget | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [todayDigest, setTodayDigest] = useState<TodayDigest>({
    cancelledCount: 0,
    newBookingCount: 0,
    leavePendingCount: 0,
    visitorCancelPendingCount: 0,
    recordAmendmentPendingCount: 0,
  });
  const showCrisisBanner =
    currentUser.activeRole === "Admin" || currentUser.activeRole === "Ops";
  const showStaffReviewCategories = currentUser.activeRole === "Assistant";
  const showTodayDigest =
    currentUser.activeRole === "Admin" ||
    currentUser.activeRole === "Ops" ||
    currentUser.activeRole === "Assistant";

  const loadCrisisUnreadCount = useCallback(async () => {
    if (!showCrisisBanner) {
      setCrisisUnreadCount(0);
      return;
    }
    try {
      const result = await fetchUnreadMessageCount("case_record_crisis");
      setCrisisUnreadCount(result.count || 0);
    } catch {
      // 保留最近一次成功读取的数量，避免加载失败时伪装成没有风险消息。
    }
  }, [showCrisisBanner]);

  const loadDigest = useCallback(async () => {
    if (!showTodayDigest) return;
    try {
      setTodayDigest(await fetchTodayMessageDigest());
    } catch {
      // 保留上一次成功读到的数字，避免轮询失败把滚动条清空。
    }
  }, [showTodayDigest]);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setListLoading(true);
      clearNotice();
    }
    try {
      const unreadOnly = appliedStatusFilter === "UNREAD";
      const messages = await fetchMessages({
        unreadOnly,
        keyword: appliedKeyword,
        category: appliedCategoryFilter === "ALL" ? undefined : appliedCategoryFilter,
      });
      const nextMessages = appliedStatusFilter === "READ" ? messages.filter((message) => message.IsRead) : messages;
      setData((prev) => ({
        ...prev,
        messages: nextMessages,
      }));
      setSelectedMessage((current) => {
        if (!current) return current;
        const next = nextMessages.find((item) => item.Id === current.Id);
        if (!next) return current;
        return {
          ...current,
          IsRead: next.IsRead,
          IsPinned: next.IsPinned,
          OfflineReceiptPending: next.OfflineReceiptPending,
          OfflineReceiptOperator: next.OfflineReceiptOperator,
          OfflineReceiptConfirmedAt: next.OfflineReceiptConfirmedAt,
        };
      });
    } catch (error) {
      if (!silent) {
        showNotice("error", error instanceof Error ? error.message : "消息加载失败");
      }
    } finally {
      if (!silent) setListLoading(false);
    }
  }, [appliedCategoryFilter, appliedKeyword, appliedStatusFilter, clearNotice, showNotice]);

  useEffect(() => {
    void loadData();
    void loadCrisisUnreadCount();
    void loadDigest();
  }, [loadData, loadCrisisUnreadCount, loadDigest, refreshKey]);

  useEffect(() => {
    if (!showTodayDigest) return;
    const timer = window.setInterval(() => {
      void loadDigest();
      void loadData({ silent: true });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadData, loadDigest, showTodayDigest]);

  const openMessage = useCallback(
    async (message: MessageItem) => {
      setSelectedMessage(null);
      setSelectedBusinessDetail(null);
      setSelectedActionTarget(null);
      setDetailLoading(true);
      clearNotice();
      try {
        await markMessageRead(message.Id);
        const detail = await fetchMessageDetail(message.Id);
        const actionTarget = resolveMessageActionTarget(detail, currentUser.activeRole);
        window.dispatchEvent(new Event(MESSAGE_UNREAD_CHANGED_EVENT));
        await loadCrisisUnreadCount();
        setData((prev) => ({
          ...prev,
          messages: prev.messages?.map((item) =>
            item.Id === message.Id ? { ...item, IsRead: true, ReadAt: detail.ReadAt || item.ReadAt } : item,
          ),
        }));
        if (actionTarget) {
          router.push(actionTarget.href);
          return;
        }
        const businessDetail = await loadMessageBusinessDetail(detail);
        setSelectedMessage(detail);
        setSelectedBusinessDetail(businessDetail);
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "消息详情加载失败");
      } finally {
        setDetailLoading(false);
      }
    },
    [clearNotice, currentUser.activeRole, loadCrisisUnreadCount, router, showNotice],
  );

  const navigateMessageTarget = useCallback(
    (target: MessageActionTarget) => {
      setSelectedMessage(null);
      setSelectedBusinessDetail(null);
      setSelectedActionTarget(null);
      router.push(target.href);
    },
    [router],
  );

  const confirmOfflineReceipt = useCallback(
    async (message: MessageItem, operatorName: string) => {
      clearNotice();
      try {
        const detail = await confirmOfflinePaymentReceipt(message.Id, operatorName);
        setSelectedMessage(detail);
        showNotice("success", "已确认线下收款，置顶已取消");
        await loadData({ silent: true });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "确认收款失败";
        showNotice("error", messageText);
        throw error instanceof Error ? error : new Error(messageText);
      }
    },
    [clearNotice, loadData, showNotice],
  );

  const searchMessages = useCallback(() => {
    setPage(1);
    setAppliedKeyword(keyword.trim());
    setAppliedStatusFilter(statusFilter);
    setAppliedCategoryFilter(categoryFilter);
  }, [categoryFilter, keyword, statusFilter]);

  const resetSearch = useCallback(() => {
    setKeyword("");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setAppliedKeyword("");
    setAppliedStatusFilter("ALL");
    setAppliedCategoryFilter("ALL");
    setPage(1);
  }, []);

  return (
    <MessagesPanel
      crisisUnreadCount={crisisUnreadCount}
      detailLoading={detailLoading}
      categoryFilter={categoryFilter}
      keyword={keyword}
      listLoading={listLoading}
      messages={data.messages}
      page={page}
      pageSize={pageSize}
      selectedBusinessDetail={selectedBusinessDetail}
      selectedActionTarget={selectedActionTarget}
      selectedMessage={selectedMessage}
      showCrisisBanner={showCrisisBanner}
      showStaffReviewCategories={showStaffReviewCategories}
      showTodayDigest={showTodayDigest}
      statusFilter={statusFilter}
      todayDigest={todayDigest}
      onCloseDetail={() => {
        setSelectedMessage(null);
        setSelectedBusinessDetail(null);
        setSelectedActionTarget(null);
      }}
      onCategoryFilterChange={setCategoryFilter}
      onConfirmOfflineReceipt={showTodayDigest ? confirmOfflineReceipt : undefined}
      onKeywordChange={setKeyword}
      onOpen={openMessage}
      onNavigateTarget={navigateMessageTarget}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPageSize(nextPageSize);
        setPage(1);
      }}
      onReset={resetSearch}
      onSearch={searchMessages}
      onStatusFilterChange={setStatusFilter}
    />
  );
}

async function loadMessageBusinessDetail(message: MessageItem): Promise<MessageBusinessDetail> {
  if (message.RelatedType !== "COUNSELOR_LEAVE") {
    return null;
  }

  const leaveRequestId = getLeaveRequestId(message);
  if (!leaveRequestId) {
    return {
      type: "leave-request",
      id: 0,
      error: "这条请假消息没有关联到具体请假申请。",
    };
  }

  try {
    const data = await fetchMessageLeaveRequestDetail(leaveRequestId);
    return {
      type: "leave-request",
      id: leaveRequestId,
      data,
    };
  } catch (error) {
    return {
      type: "leave-request",
      id: leaveRequestId,
      error: error instanceof Error ? error.message : "请假申请详情加载失败",
    };
  }
}

function getLeaveRequestId(message: MessageItem) {
  const detail = parseMessageDetail(message.Content);
  const detailId = numberFromUnknown(detail?.leaveRequestId);
  if (detailId) {
    return detailId;
  }
  return numberFromUnknown(message.RelatedId);
}

function parseMessageDetail(content?: string | null) {
  if (!content) {
    return null;
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const detail = (parsed as { detail?: unknown }).detail;
    return detail && typeof detail === "object" && !Array.isArray(detail) ? (detail as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function numberFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
