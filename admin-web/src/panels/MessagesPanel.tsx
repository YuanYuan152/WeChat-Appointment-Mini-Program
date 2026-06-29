import { formatDateTime, statusLabel } from "@/lib/format";
import type { MessageItem } from "@/types/api";

import { Badge, EmptyState, PanelHeader, TableActionButton } from "@/components/ui";

type MessagePayload = {
  summary?: unknown;
  detail?: Record<string, unknown>;
};

export function MessagesPanel({
  messages,
  onOpen,
}: {
  messages?: MessageItem[];
  onOpen: (message: MessageItem) => void;
}) {
  const items = messages || [];

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader title="我的消息" description="查看当前登录角色收到的提醒，点击消息进入对应处理页面。" />
      {items.length === 0 ? (
        <EmptyState text="暂无消息。" />
      ) : (
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[17%]" />
            <col className="w-[38%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 font-medium">标题</th>
              <th className="px-5 py-3 font-medium">内容</th>
              <th className="px-5 py-3 font-medium">关联</th>
              <th className="px-5 py-3 font-medium">时间</th>
              <th className="px-5 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const display = getMessageDisplay(item);
              return (
                <tr key={item.Id} className="border-t border-[var(--lxxl-border)] align-top">
                  <td className="px-5 py-4">
                    <Badge tone={item.IsRead ? "neutral" : "gold"}>{item.IsRead ? "已读" : "未读"}</Badge>
                  </td>
                  <td className="break-words px-5 py-4 font-medium">{item.Title}</td>
                  <td className="px-5 py-4">
                    <div className="space-y-2">
                      <div className="line-clamp-2 break-words text-[var(--lxxl-text)]">{display.summary}</div>
                      {display.details.length > 0 && (
                        <div className="space-y-1 text-xs leading-5 text-[var(--lxxl-muted)]">
                          {display.details.map((detail) => (
                            <div key={detail.label} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
                              <span>{detail.label}</span>
                              <span className="min-w-0 break-words">{detail.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[var(--lxxl-muted)]">
                    <div className="break-words text-[var(--lxxl-text)]">{display.relatedLabel}</div>
                    {display.relatedId && <div className="mt-1 text-xs">编号 {display.relatedId}</div>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-[var(--lxxl-muted)]">{formatDateTime(item.CreatedAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <TableActionButton onClick={() => onOpen(item)}>查看</TableActionButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function getMessageDisplay(item: MessageItem) {
  const payload = parseMessagePayload(item.Content);
  const detail = payload?.detail || {};
  const summarySource = typeof payload?.summary === "string" ? payload.summary : item.Content || "-";
  const summary = humanizeText(summarySource);
  const details = messageDetailRows(detail);

  return {
    summary,
    details,
    relatedLabel: relatedTypeLabel(item.RelatedType),
    relatedId: item.RelatedId || undefined,
  };
}

function parseMessagePayload(content?: string | null): MessagePayload | undefined {
  if (!content) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as MessagePayload;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function messageDetailRows(detail: Record<string, unknown>) {
  const rows: Array<{ label: string; value: string }> = [];
  const rejectReason = stringValue(detail.rejectReason);
  const status = stringValue(detail.status);
  const startTime = stringValue(detail.startTime);
  const counselorName = stringValue(detail.counselorName);
  const patientName = stringValue(detail.patientName);

  if (rejectReason) {
    rows.push({ label: "驳回原因", value: rejectReason });
  }
  if (status) {
    rows.push({ label: "处理状态", value: statusLabel(status) });
  }
  if (startTime) {
    rows.push({ label: "咨询时间", value: formatDateTime(startTime) });
  }
  if (counselorName) {
    rows.push({ label: "咨询师", value: counselorName });
  }
  if (patientName) {
    rows.push({ label: "来访者", value: patientName });
  }

  return rows.slice(0, 3);
}

function relatedTypeLabel(type?: string | null) {
  const labels: Record<string, string> = {
    REFUND_EXEMPTION: "豁免申请",
    REFUND_EXEMPTION_PENDING: "待审豁免",
    CASE_RECORD: "咨询记录",
    CONSULTATION_RECORD: "咨询记录",
    CASE_RECORD_AMENDMENT: "咨询记录修改申请",
    CASE_RECORD_AMENDMENT_PENDING: "待审咨询记录修改",
    CASE_RECORD_CRISIS_REPORT: "风险上报",
    FEEDBACK: "用户反馈",
    CONSULTATION: "咨询预约",
    SCHEDULE: "排期",
    COUNSELOR_LEAVE: "咨询师请假",
    COUNSELOR_APPOINTMENT_NEW: "新预约",
    COUNSELOR_APPOINTMENT_CANCEL: "预约取消",
    COUNSELOR_CONSULTATION_REMIND: "咨询提醒",
    COUNSELOR_LEAVE_SUBMITTED: "请假申请",
    COUNSELOR_LEAVE_SUCCESS: "请假结果",
    COUNSELOR_CONSULTATION_DONE: "咨询完成",
    PATIENT_APPOINTMENT_SUCCESS: "预约成功",
    PATIENT_APPOINTMENT_CANCEL: "预约取消",
    PATIENT_LEAVE_APPROVED: "咨询师请假",
    PATIENT_NEW_ACTIVITY: "活动提醒",
  };

  return type ? labels[type] || humanizeText(type) : "-";
}

function humanizeText(value: string) {
  return value
    .replace(/记录#(\d+)/g, "咨询记录 $1")
    .replace(/排期\s*#(\d+)/g, "排期 $1")
    .replace(/咨询\s*#(\d+)/g, "咨询 $1")
    .replace(/_/g, " ");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
