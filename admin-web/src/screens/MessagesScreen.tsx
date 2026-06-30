"use client";

import { useCallback, useEffect, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { MessagesPanel } from "@/panels/MessagesPanel";
import type { MessageReadFilter } from "@/panels/MessagesPanel";
import { fetchMessageDetail, fetchMessages, markMessageRead, MESSAGE_UNREAD_CHANGED_EVENT } from "@/services/messages";
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
  const { clearNotice, refreshKey, setLoading, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<MessageReadFilter>("ALL");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [appliedStatusFilter, setAppliedStatusFilter] = useState<MessageReadFilter>("ALL");
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [appliedKeyword, appliedStatusFilter, clearNotice, setLoading, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const openMessage = useCallback(
    async (message: MessageItem) => {
      setLoading(true);
      clearNotice();
      try {
        await markMessageRead(message.Id);
        const detail = await fetchMessageDetail(message.Id);
        window.dispatchEvent(new Event(MESSAGE_UNREAD_CHANGED_EVENT));
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
        setLoading(false);
      }
    },
    [clearNotice, setLoading, showNotice],
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
      keyword={keyword}
      messages={data.messages}
      selectedMessage={selectedMessage}
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
