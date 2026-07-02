"use client";

import { useCallback, useEffect, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { MessagesPanel } from "@/panels/MessagesPanel";
import type { MessageReadFilter } from "@/panels/MessagesPanel";
import {
  fetchMessageDetail,
  fetchMessages,
  fetchUnreadMessageCount,
  markMessageRead,
  MESSAGE_UNREAD_CHANGED_EVENT,
} from "@/services/messages";
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
  const { clearNotice, currentUser, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<MessageReadFilter>("ALL");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [appliedStatusFilter, setAppliedStatusFilter] = useState<MessageReadFilter>("ALL");
  const [crisisUnreadCount, setCrisisUnreadCount] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const showCrisisBanner = currentUser.roles.includes("Admin") || currentUser.roles.includes("Ops");

  const loadCrisisUnreadCount = useCallback(async () => {
    if (!showCrisisBanner) {
      setCrisisUnreadCount(0);
      return;
    }
    try {
      const result = await fetchUnreadMessageCount("case_record_crisis");
      setCrisisUnreadCount(result.count || 0);
    } catch {
      setCrisisUnreadCount(0);
    }
  }, [showCrisisBanner]);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const unreadOnly = appliedStatusFilter === "UNREAD";
      const messages = await fetchMessages({ unreadOnly, keyword: appliedKeyword });
      setData((prev) => ({
        ...prev,
        messages: appliedStatusFilter === "READ" ? messages.filter((message) => message.IsRead) : messages,
      }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "消息加载失败");
    } finally {
      setListLoading(false);
    }
  }, [appliedKeyword, appliedStatusFilter, clearNotice, showNotice]);

  useEffect(() => {
    void loadData();
    void loadCrisisUnreadCount();
  }, [loadData, loadCrisisUnreadCount, refreshKey]);

  const openMessage = useCallback(
    async (message: MessageItem) => {
      setSelectedMessage(message);
      setDetailLoading(true);
      clearNotice();
      try {
        await markMessageRead(message.Id);
        const detail = await fetchMessageDetail(message.Id);
        window.dispatchEvent(new Event(MESSAGE_UNREAD_CHANGED_EVENT));
        await loadCrisisUnreadCount();
        setSelectedMessage(detail);
        setData((prev) => ({
          ...prev,
          messages: prev.messages?.map((item) =>
            item.Id === message.Id ? { ...item, IsRead: true, ReadAt: detail.ReadAt || item.ReadAt } : item,
          ),
        }));
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "消息详情加载失败");
      } finally {
        setDetailLoading(false);
      }
    },
    [clearNotice, loadCrisisUnreadCount, showNotice],
  );

  const searchMessages = useCallback(() => {
    setAppliedKeyword(keyword.trim());
    setAppliedStatusFilter(statusFilter);
  }, [keyword, statusFilter]);

  const resetSearch = useCallback(() => {
    setKeyword("");
    setStatusFilter("ALL");
    setAppliedKeyword("");
    setAppliedStatusFilter("ALL");
  }, []);

  return (
    <MessagesPanel
      crisisUnreadCount={crisisUnreadCount}
      detailLoading={detailLoading}
      keyword={keyword}
      listLoading={listLoading}
      messages={data.messages}
      selectedMessage={selectedMessage}
      showCrisisBanner={showCrisisBanner}
      statusFilter={statusFilter}
      onCloseDetail={() => setSelectedMessage(null)}
      onKeywordChange={setKeyword}
      onOpen={openMessage}
      onReset={resetSearch}
      onSearch={searchMessages}
      onStatusFilterChange={setStatusFilter}
    />
  );
}
