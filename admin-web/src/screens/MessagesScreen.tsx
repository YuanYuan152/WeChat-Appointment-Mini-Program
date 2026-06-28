"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { MessagesPanel } from "@/panels/MessagesPanel";
import { fetchMessages, markMessageRead } from "@/services/messages";
import { sectionPathById } from "@/config/navigation";
import type { MessageItem, Role } from "@/types/api";
import type { ScreenData, SectionId } from "@/types/app";

const relatedSectionMap: Record<string, SectionId> = {
  REFUND_EXEMPTION: "refunds",
  REFUND_EXEMPTION_PENDING: "refunds",
  CASE_RECORD: "caseRecords",
  CONSULTATION_RECORD: "caseRecords",
  CASE_RECORD_AMENDMENT_PENDING: "caseRecords",
  CASE_RECORD_CRISIS_REPORT: "caseRecords",
  FEEDBACK: "feedback",
  CONSULTATION: "operationLogs",
  SCHEDULE: "schedules",
  COUNSELOR_LEAVE: "schedules",
};

const counselorRelatedSectionMap: Record<string, SectionId> = {
  COUNSELOR_APPOINTMENT_NEW: "counselorSchedules",
  COUNSELOR_APPOINTMENT_CANCEL: "counselorSchedules",
  COUNSELOR_CONSULTATION_REMIND: "counselorSchedules",
  COUNSELOR_LEAVE_SUBMITTED: "counselorSchedules",
  COUNSELOR_LEAVE_SUCCESS: "counselorSchedules",
  COUNSELOR_CONSULTATION_DONE: "counselorRecords",
  CASE_RECORD_AMENDMENT: "counselorRecords",
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
  const { clearNotice, currentUser, refreshKey, runAction, setLoading, showNotice } = useAppRoute();
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
      const targetSection = resolveMessageTarget(message.RelatedType, currentUser.roles);
      if (targetSection) {
        router.push(sectionPathById[targetSection]);
      }
    },
    [currentUser.roles, router, runAction],
  );

  return <MessagesPanel messages={data.messages} onOpen={openMessage} />;
}

function resolveMessageTarget(relatedType: string | null | undefined, roles: Role[]) {
  if (!relatedType) {
    return undefined;
  }
  if (roles.includes("Counselor") && !roles.some((role) => role === "Admin" || role === "Ops")) {
    return counselorRelatedSectionMap[relatedType] || relatedSectionMap[relatedType];
  }
  return relatedSectionMap[relatedType] || counselorRelatedSectionMap[relatedType];
}
