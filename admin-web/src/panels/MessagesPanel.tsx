import { DetailDrawer } from "@/components/boards/DetailDrawer";
import { formatDateTime, formatFullDateTime, statusLabel } from "@/lib/format";
import type { MessageItem } from "@/types/api";

import {
  Badge,
  EmptyState,
  PanelHeader,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";

type MessagePayload = {
  summary?: unknown;
  detail?: Record<string, unknown>;
};

export type MessageReadFilter = "ALL" | "UNREAD" | "READ";

export function MessagesPanel({
  crisisUnreadCount,
  detailLoading,
  listLoading,
  messages,
  keyword,
  selectedMessage,
  showCrisisBanner,
  statusFilter,
  onCloseDetail,
  onKeywordChange,
  onOpen,
  onReset,
  onSearch,
  onStatusFilterChange,
}: {
  crisisUnreadCount?: number;
  detailLoading?: boolean;
  listLoading?: boolean;
  messages?: MessageItem[];
  keyword: string;
  selectedMessage?: MessageItem | null;
  showCrisisBanner?: boolean;
  statusFilter: MessageReadFilter;
  onCloseDetail: () => void;
  onKeywordChange: (value: string) => void;
  onOpen: (message: MessageItem) => void;
  onReset: () => void;
  onSearch: () => void;
  onStatusFilterChange: (value: MessageReadFilter) => void;
}) {
  const items = messages || [];
  const crisisMessages = items.filter(isCrisisReportMessage);
  const currentListCrisisCount = crisisMessages.length;
  const unreadCrisisCount = crisisUnreadCount ?? crisisMessages.filter((item) => !item.IsRead).length;

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader title="我的消息" description="查看当前登录角色收到的提醒，点击查看打开该消息详情。" />
      <form
        className="border-b border-[var(--lxxl-border)] px-6 py-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QueryField label="读取状态">
            <select
              className={queryControlClass}
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as MessageReadFilter)}
            >
              <option value="ALL">全部</option>
              <option value="UNREAD">未读</option>
              <option value="READ">已读</option>
            </select>
          </QueryField>
          <QueryField label="关键词">
            <input
              className={queryControlClass}
              placeholder="来访姓名 / 消息类型 / 标题"
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
            />
          </QueryField>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <QueryButton type="submit">查询</QueryButton>
          <QueryResetButton onClick={onReset}>重置</QueryResetButton>
        </div>
      </form>
      {showCrisisBanner && (
        <div
          aria-live="polite"
          className={`mx-6 my-5 flex w-[calc(100%-3rem)] items-center justify-between gap-5 rounded-xl border px-5 py-4 text-sm ${
            unreadCrisisCount > 0
              ? "border-[#F3B18D] bg-[#FFF2EA] text-[#A94616]"
              : "border-[#F1D3C2] bg-[#FFF8F3] text-[#C45A1A]"
          }`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F8D9C9] text-base font-bold text-[#C2410C]">
              !
            </span>
            <div className="min-w-0">
              <div className="font-semibold">个案风险上报未读 {unreadCrisisCount} 条</div>
              <div className="mt-1 text-xs leading-5 opacity-80">
                风险上报消息会在列表中高亮，可通过读取状态和关键词筛选定位。
              </div>
            </div>
          </div>
          <div className="shrink-0 text-xs font-medium">
            当前列表 {currentListCrisisCount} 条
          </div>
        </div>
      )}
      <div className="relative">
        {listLoading && items.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载列表...
          </div>
        )}
        {items.length === 0 ? (
          <EmptyState text={listLoading ? "正在加载列表..." : "暂无消息。"} />
        ) : (
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[17%]" />
              <col className="w-[36%]" />
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
                const isCrisis = isCrisisReportMessage(item);
                return (
                  <tr
                    key={item.Id}
                    className={`border-t border-[var(--lxxl-border)] align-top ${
                      isCrisis ? "bg-[#FFF8F3]" : ""
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <Badge tone={item.IsRead ? "neutral" : "gold"}>{item.IsRead ? "已读" : "未读"}</Badge>
                        {isCrisis && <Badge tone="red">风险上报</Badge>}
                      </div>
                    </td>
                    <td className="break-words px-5 py-4">
                      <div className="space-y-2">
                        <Badge tone={isCrisis ? "red" : "green"}>{display.categoryLabel}</Badge>
                        <div className={`font-medium ${isCrisis ? "text-[#A94616]" : ""}`}>
                          {display.title}
                        </div>
                      </div>
                    </td>
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
                    <td className="whitespace-nowrap px-5 py-4 text-[var(--lxxl-muted)]">
                      {formatDateTime(item.CreatedAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <TableActionButton onClick={() => onOpen(item)}>查看</TableActionButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {selectedMessage && (
        <MessageDetailDrawer loading={detailLoading} message={selectedMessage} onClose={onCloseDetail} />
      )}
    </section>
  );
}

function MessageDetailDrawer({
  loading,
  message,
  onClose,
}: {
  loading?: boolean;
  message: MessageItem;
  onClose: () => void;
}) {
  const display = getMessageDisplay(message);
  const detail = parseMessagePayload(message.Content)?.detail || {};
  const sections = buildMessageDetailSections(message, detail, display.summary);
  const isCrisis = isCrisisReportMessage(message);

  return (
    <DetailDrawer title={`${display.title}详情`} onClose={onClose}>
      <div className="space-y-6">
        {loading && (
          <div className="rounded-lg border border-[var(--lxxl-border)] bg-[#FAF8F4] px-4 py-3 text-sm text-[var(--lxxl-muted)]">
            正在加载最新消息详情...
          </div>
        )}
        <section className="border-b border-[var(--lxxl-border)] pb-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone={message.IsRead ? "neutral" : "gold"}>{message.IsRead ? "已读" : "未读"}</Badge>
            <Badge tone={isCrisis ? "red" : "green"}>{display.categoryLabel}</Badge>
          </div>
          <h4 className="text-base font-semibold text-[var(--lxxl-text)]">{display.title}</h4>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--lxxl-muted)]">{display.summary}</p>
        </section>

        {sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h4 className="text-sm font-semibold text-[var(--lxxl-text)]">{section.title}</h4>
            <div className="divide-y divide-[var(--lxxl-border)]">
              {section.rows.map((row) => (
                <div key={`${section.title}-${row.label}`} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-2 text-sm">
                  <span className="text-[var(--lxxl-muted)]">{row.label}</span>
                  <span className="whitespace-pre-line break-words text-[var(--lxxl-text)]">{row.value}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </DetailDrawer>
  );
}

type DetailRow = {
  label: string;
  value: string;
};

type DetailSection = {
  title: string;
  rows: DetailRow[];
};

function buildMessageDetailSections(
  message: MessageItem,
  detail: Record<string, unknown>,
  summary: string,
): DetailSection[] {
  const consultationTime = timeRangeText(detail);
  const location =
    detailText(detail, "location") ||
    [detailText(detail, "centerName"), detailText(detail, "roomName")].filter(Boolean).join(" ");
  const rawStatus = detailText(detail, "status");
  const status = detailText(detail, "statusLabel") || (rawStatus ? statusLabel(rawStatus) : "");
  const crisisLevel = detailText(detail, "crisisLevelLabel") || detailText(detail, "crisisLevel");

  const sections: DetailSection[] = [
    {
      title: "消息信息",
      rows: compactRows([
        { label: "标题", value: messageDisplayTitle(message) },
        { label: "消息类型", value: messageCategoryLabel(message) },
        { label: "关联业务", value: relatedBusinessText(message) },
        { label: "创建时间", value: formatFullDateTime(message.CreatedAt) },
        { label: "读取时间", value: message.ReadAt ? formatFullDateTime(message.ReadAt) : "" },
        { label: "提示", value: detailText(detail, "tip") },
      ]),
    },
    {
      title: "业务详情",
      rows: compactRows([
        { label: "处理状态", value: status },
        { label: "风险等级", value: isCrisisReportMessage(message) ? crisisLevel : "" },
        { label: "咨询师", value: personText(detail, "counselorName", "counselorPhone") },
        { label: "来访者", value: personText(detail, "patientName", "patientPhone") },
        { label: "时间", value: consultationTime },
        { label: "地点", value: location },
        { label: "请假原因", value: detailText(detail, "leaveReason") },
        { label: "退款说明", value: detailText(detail, "refundText") },
        { label: "豁免申请", value: detailText(detail, "exemptionLabel") },
        { label: "摘要", value: summary },
      ]),
    },
    {
      title: "受影响预约",
      rows: affectedAppointmentRows(detail),
    },
    {
      title: "补充字段",
      rows: extraDetailRows(detail),
    },
  ];

  return sections.filter((section) => section.rows.length > 0);
}

function compactRows(rows: DetailRow[]) {
  return rows.filter((row) => row.value && row.value !== "-");
}

function relatedBusinessText(message: MessageItem) {
  const label = relatedTypeLabel(message.RelatedType);
  return message.RelatedId ? `${label} #${message.RelatedId}` : label;
}

function detailText(detail: Record<string, unknown>, key: string) {
  return formatDetailValue(detail[key]);
}

function formatDetailValue(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return humanizeText(value.trim());
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? `${value.length} 条` : "";
  }
  if (typeof value === "object") {
    return "";
  }
  return String(value);
}

function timeRangeText(detail: Record<string, unknown>) {
  const startTime = detailText(detail, "startTime");
  const endTime = detailText(detail, "endTime");
  if (!startTime) {
    return "";
  }
  return endTime ? `${formatFullDateTime(startTime)} 至 ${formatFullDateTime(endTime)}` : formatFullDateTime(startTime);
}

function personText(detail: Record<string, unknown>, nameKey: string, phoneKey: string) {
  const name = detailText(detail, nameKey);
  const phone = detailText(detail, phoneKey);
  if (!name) {
    return "";
  }
  return phone ? `${name}（${phone}）` : name;
}

function affectedAppointmentRows(detail: Record<string, unknown>) {
  const appointments = Array.isArray(detail.affectedAppointments) ? detail.affectedAppointments : [];
  return appointments
    .map((appointment, index) => {
      if (!appointment || typeof appointment !== "object" || Array.isArray(appointment)) {
        return null;
      }
      return {
        label: `预约 ${index + 1}`,
        value: affectedAppointmentText(appointment as Record<string, unknown>),
      };
    })
    .filter((row): row is DetailRow => !!row && !!row.value);
}

function affectedAppointmentText(appointment: Record<string, unknown>) {
  const patient = personText(appointment, "patientName", "patientPhone") || detailText(appointment, "patientName");
  const emergency = personText(appointment, "emergencyContact", "emergencyPhone");
  const time = timeRangeText(appointment);
  const location = detailText(appointment, "location");
  const refund = detailText(appointment, "refundText");
  const status = detailText(appointment, "orderStatus");
  return compactTextLines([
    patient ? `来访者：${patient}` : "",
    emergency ? `紧急联系人：${emergency}` : "",
    time ? `咨询时间：${time}` : "",
    location ? `地点：${location}` : "",
    refund ? `退款说明：${refund}` : "",
    status ? `订单状态：${statusLabel(status)}` : "",
  ]);
}

const knownDetailKeys = new Set([
  "affectedAppointments",
  "amount",
  "caseRecordId",
  "centerName",
  "consultationId",
  "counselorName",
  "counselorPhone",
  "crisisLevel",
  "crisisLevelLabel",
  "endTime",
  "exemptionLabel",
  "leaveReason",
  "leaveRequestId",
  "location",
  "patientName",
  "patientPhone",
  "refundText",
  "rejectReason",
  "roomName",
  "scheduleId",
  "screenshotUrl",
  "startTime",
  "status",
  "statusLabel",
  "tip",
]);

function extraDetailRows(detail: Record<string, unknown>) {
  return Object.entries(detail)
    .filter(([key, value]) => !knownDetailKeys.has(key) && formatDetailValue(value))
    .map(([key, value]) => ({
      label: detailFieldLabel(key),
      value: formatDetailValue(value),
    }));
}

function detailFieldLabel(key: string) {
  const labels: Record<string, string> = {
    approved: "审核结果",
    detail: "详情",
    reason: "原因",
    resultText: "处理结果",
    summary: "摘要",
  };
  return labels[key] || humanizeText(key);
}

function compactTextLines(lines: string[]) {
  return lines.filter(Boolean).join("\n");
}

function getMessageDisplay(item: MessageItem) {
  const payload = parseMessagePayload(item.Content);
  const detail = payload?.detail || {};
  const summarySource = typeof payload?.summary === "string" ? payload.summary : item.Content || "-";
  const summary = humanizeText(summarySource);
  const details = messageDetailRows(detail, item);

  return {
    title: messageDisplayTitle(item),
    categoryLabel: messageCategoryLabel(item),
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

function messageDetailRows(detail: Record<string, unknown>, item: MessageItem) {
  const rows: Array<{ label: string; value: string }> = [];
  const rejectReason = stringValue(detail.rejectReason);
  const status = stringValue(detail.status);
  const startTime = stringValue(detail.startTime);
  const counselorName = stringValue(detail.counselorName);
  const counselorPhone = stringValue(detail.counselorPhone);
  const patientName = stringValue(detail.patientName);
  const patientPhone = stringValue(detail.patientPhone);
  const crisisLevelLabel = stringValue(detail.crisisLevelLabel) || stringValue(detail.crisisLevel);

  if (isCrisisReportMessage(item) && crisisLevelLabel) {
    rows.push({ label: "风险等级", value: crisisLevelLabel });
  }

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
    rows.push({ label: "咨询师", value: counselorPhone ? `${counselorName}（${counselorPhone}）` : counselorName });
  }
  if (patientName) {
    rows.push({ label: "来访者", value: patientPhone ? `${patientName}（${patientPhone}）` : patientName });
  }

  return rows.slice(0, isCrisisReportMessage(item) ? 4 : 3);
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

function messageDisplayTitle(item: MessageItem) {
  if (isCrisisReportMessage(item)) {
    return "个案风险需上报";
  }
  return item.Title || "消息";
}

function messageCategoryLabel(item: MessageItem) {
  if (isCrisisReportMessage(item)) {
    return "风险需上报";
  }
  return relatedTypeLabel(item.RelatedType);
}

function isCrisisReportMessage(item: MessageItem) {
  if (item.RelatedType === "CASE_RECORD_CRISIS_REPORT") {
    return true;
  }
  const title = item.Title || "";
  if (title.includes("个案风险需上报") || title.includes("风险需上报")) {
    return true;
  }
  return item.Type === "RISK" && title.includes("风险");
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
