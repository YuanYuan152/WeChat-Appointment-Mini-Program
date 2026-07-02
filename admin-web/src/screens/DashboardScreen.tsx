"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatMoneyFromCents, statusLabel } from "@/lib/format";

import { fetchDashboardData } from "@/services/dashboard";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { DashboardPanel } from "@/panels/DashboardPanel";
import type { MessageItem } from "@/types/api";
import type { ScreenData } from "@/types/app";

export function DashboardScreen() {
  return (
    <AppRoute sectionId="dashboard">
      <DashboardScreenContent />
    </AppRoute>
  );
}

function DashboardScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    clearNotice();
    try {
      const { dashboard, refunds, counselorRecords, roomStatus, messages } = await fetchDashboardData();
      setData((prev) => ({ ...prev, dashboard, refunds, counselorRecords, roomStatus, messages }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "总览加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearNotice, setLoading, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const summaryRows = useMemo(() => {
    const pending = data.refunds?.slice(0, 4).map((item) => ({
      time: item.createdAt,
      type: "豁免审核",
      subject: `${item.patientName} / ${item.counselorName}`,
      status: statusLabel(item.status),
      amount: formatMoneyFromCents(item.amount),
    }));
    const rooms = data.roomStatus?.rooms
      ?.filter((room) => room.occupancy === "IN_SESSION")
      .slice(0, 4)
      .map((room) => ({
        time: room.startTime || room.atTime || "",
        type: "咨询室占用",
        subject: `${room.centerName} / ${room.name}`,
        status: room.patientName || statusLabel(room.occupancy),
        amount: room.counselorName || "-",
      }));
    const missingRecords = data.counselorRecords
      ?.filter((record) => record.missingCount > 0)
      .slice(0, 4)
      .map((record) => ({
        time: "",
        type: "待补咨询记录",
        subject: record.counselorName,
        status: `缺 ${record.missingCount}`,
        amount: `已完成 ${record.completedCount} / 已写 ${record.recordedCount}`,
      }));

    const unreadMessages = data.messages?.slice(0, 4).map((message) => {
      const detail = parseMessageDetail(message);
      const isCrisis = isRiskMessage(message);
      return {
        time: message.CreatedAt,
        type: isCrisis ? "风险上报" : messageTypeLabel(message),
        subject: messageSubject(message, detail),
        status: message.IsRead ? "已读" : "未读",
        amount: messageRelatedText(message, detail),
        tone: isCrisis ? "red" : "gold",
      };
    });

    return [...(unreadMessages || []), ...(pending || []), ...(missingRecords || []), ...(rooms || [])].slice(0, 6);
  }, [data.counselorRecords, data.messages, data.refunds, data.roomStatus]);

  return <DashboardPanel data={data} loading={loading} summaryRows={summaryRows} />;
}

function parseMessageDetail(message: MessageItem) {
  if (!message.Content) {
    return {};
  }
  try {
    const parsed = JSON.parse(message.Content) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const detail = (parsed as { detail?: unknown }).detail;
      if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        return detail as Record<string, unknown>;
      }
    }
  } catch {
    return {};
  }
  return {};
}

function messageTypeLabel(message: MessageItem) {
  const labels: Record<string, string> = {
    CASE_RECORD_AMENDMENT_PENDING: "咨询记录修改",
    CASE_RECORD_CRISIS_REPORT: "风险上报",
    COUNSELOR_LEAVE_SUBMITTED: "咨询师请假",
    FEEDBACK: "用户反馈",
    REFUND_EXEMPTION_PENDING: "豁免审核",
  };
  return message.RelatedType ? labels[message.RelatedType] || message.Title || "消息提醒" : message.Title || "消息提醒";
}

function messageSubject(message: MessageItem, detail: Record<string, unknown>) {
  const counselor = stringValue(detail.counselorName);
  const patient = stringValue(detail.patientName);
  const crisisLevel = stringValue(detail.crisisLevelLabel) || stringValue(detail.crisisLevel);
  const people = [counselor, patient].filter(Boolean).join(" / ");
  if (people && crisisLevel) {
    return `${people} · ${crisisLevel}`;
  }
  if (people) {
    return people;
  }
  return message.Title || "消息提醒";
}

function messageRelatedText(message: MessageItem, detail: Record<string, unknown>) {
  const startTime = stringValue(detail.startTime);
  const status = stringValue(detail.statusLabel) || stringValue(detail.status);
  const related = messageTypeLabel(message);
  return [startTime ? formatMessageTime(startTime) : "", statusLabel(status || ""), related].filter(Boolean).join(" / ") || "-";
}

function formatMessageTime(value: string) {
  return value.length >= 16 ? value.slice(5, 16).replace("T", " ") : value;
}

function isRiskMessage(message: MessageItem) {
  return (
    message.RelatedType === "CASE_RECORD_CRISIS_REPORT" ||
    message.Title.includes("风险") ||
    (message.Type === "RISK" && message.Title.includes("上报"))
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
