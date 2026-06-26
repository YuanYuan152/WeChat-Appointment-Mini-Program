"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { MessagesPanel } from "@/panels/MessagesPanel";
import { fetchMessages, markMessageRead } from "@/services/messages";
import { sectionPathById } from "@/config/navigation";
import type { MessageItem } from "@/types/api";
import type { ScreenData, SectionId } from "@/types/app";

const relatedSectionMap: Record<string, SectionId> = {
  REFUND_EXEMPTION: "refunds",
  CASE_RECORD: "caseRecords",
  CONSULTATION_RECORD: "caseRecords",
  FEEDBACK: "feedback",
  CONSULTATION: "operationLogs",
  SCHEDULE: "schedules",
};

export function MessagesScreen() {
  return (
    <AppRoute sectionId="messages">
      <MessagesScreenContent />
    </AppRoute>
  );
}

function MessagesScreenContent() {
  const router = useRouter();
  const { clearNotice, refreshKey, runAction, setLoading, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    clearNotice();
    try {
      const messages = await fetchMessages(false);
      setData((prev) => ({ ...prev, messages }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "消息加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearNotice, setLoading, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const openMessage = useCallback(
    async (message: MessageItem) => {
      await runAction(() => markMessageRead(message.Id), "消息已标记为已读");
      const targetSection = message.RelatedType ? relatedSectionMap[message.RelatedType] : undefined;
      if (targetSection) {
        router.push(sectionPathById[targetSection]);
      }
    },
    [router, runAction],
  );

  return <MessagesPanel messages={data.messages} onOpen={openMessage} />;
}
