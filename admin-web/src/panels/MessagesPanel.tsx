import { DetailDrawer } from "@/components/boards/DetailDrawer";
import { formatDateTime, formatFullDateTime, statusLabel } from "@/lib/format";
import type { MessageActionTarget } from "@/lib/messageNavigation";
import { getPageItems } from "@/lib/pagination";
import { formatPatientNameWithContractTag } from "@/lib/patientContract";
import type { AdminLeaveRequestDetail, MessageItem } from "@/types/api";

import {
  Badge,
  EmptyState,
  PanelHeader,
  Pagination,
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

export type MessageBusinessDetail =
  | {
      type: "leave-request";
      id: number;
      data?: AdminLeaveRequestDetail | null;
      error?: string;
    }
  | null;

export type MessageReadFilter = "ALL" | "UNREAD" | "READ";
export type MessageCategoryFilter =
  | "ALL"
  | "case_record_crisis"
  | "exemption"
  | "counselor_leave"
  | "case_record_amendment"
  | "appointment_new"
  | "appointment_cancel"
  | "appointment_remind"
  | "consultation_remind"
  | "leave_submitted"
  | "consultation_done"
  | "activity"
  | "leave_notice"
  | "charity_milestone"
  | "professional_pair_milestone"
  | "pricing"
  | "proxy_booking";

/** 管理工作台（助理/主任/管理员）共用消息类型，与小程序保持一致 */
const staffWorkbenchMessageCategoryOptions: Array<{ value: MessageCategoryFilter; label: string }> = [
  { value: "ALL", label: "全部类型" },
  { value: "appointment_new", label: "新增预约" },
  { value: "appointment_cancel", label: "预约取消" },
  { value: "exemption", label: "豁免审核" },
  { value: "counselor_leave", label: "咨询师请假" },
  { value: "case_record_amendment", label: "记录修改审核" },
  { value: "case_record_crisis", label: "风险上报" },
  { value: "charity_milestone", label: "公益咨询30次提示" },
  { value: "professional_pair_milestone", label: "正价咨询30次提示" },
  { value: "pricing", label: "定价与抽成" },
  { value: "proxy_booking", label: "代理预约" },
];

const counselorMessageCategoryOptions: Array<{ value: MessageCategoryFilter; label: string }> = [
  { value: "ALL", label: "全部类型" },
  { value: "appointment_new", label: "新预约" },
  { value: "leave_submitted", label: "请假提交" },
  { value: "consultation_remind", label: "咨询提醒" },
  { value: "consultation_done", label: "咨询完成" },
  { value: "case_record_amendment", label: "记录修改" },
  { value: "appointment_cancel", label: "预约取消" },
  { value: "proxy_booking", label: "代理预约" },
];

export function MessagesPanel({
  crisisUnreadCount,
  detailLoading,
  listLoading,
  messages,
  keyword,
  categoryFilter,
  page,
  pageSize,
  selectedActionTarget,
  selectedBusinessDetail,
  selectedMessage,
  showCrisisBanner,
  showStaffReviewCategories,
  statusFilter,
  onCloseDetail,
  onKeywordChange,
  onCategoryFilterChange,
  onNavigateTarget,
  onOpen,
  onPageChange,
  onPageSizeChange,
  onReset,
  onSearch,
  onStatusFilterChange,
}: {
  crisisUnreadCount?: number | null;
  detailLoading?: boolean;
  listLoading?: boolean;
  messages?: MessageItem[];
  keyword: string;
  categoryFilter: MessageCategoryFilter;
  page: number;
  pageSize: number;
  selectedActionTarget?: MessageActionTarget | null;
  selectedBusinessDetail?: MessageBusinessDetail;
  selectedMessage?: MessageItem | null;
  showCrisisBanner?: boolean;
  showStaffReviewCategories?: boolean;
  statusFilter: MessageReadFilter;
  onCloseDetail: () => void;
  onKeywordChange: (value: string) => void;
  onCategoryFilterChange: (value: MessageCategoryFilter) => void;
  onNavigateTarget?: (target: MessageActionTarget) => void;
  onOpen: (message: MessageItem) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onReset: () => void;
  onSearch: () => void;
  onStatusFilterChange: (value: MessageReadFilter) => void;
}) {
  const items = messages || [];
  const { currentPage, items: pageItems } = getPageItems(items, page, pageSize);
  const crisisMessages = items.filter(isCrisisReportMessage);
  const currentListCrisisCount = crisisMessages.length;
  const unreadCrisisCount = crisisUnreadCount;
  const categoryOptions =
    showCrisisBanner || showStaffReviewCategories
      ? staffWorkbenchMessageCategoryOptions
      : counselorMessageCategoryOptions;

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
          <QueryField label="消息类型">
            <select
              className={queryControlClass}
              value={categoryFilter}
              onChange={(event) => onCategoryFilterChange(event.target.value as MessageCategoryFilter)}
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
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
            unreadCrisisCount != null && unreadCrisisCount > 0
              ? "border-[#F3B18D] bg-[#FFF2EA] text-[#A94616]"
              : "border-[#F1D3C2] bg-[#FFF8F3] text-[#C45A1A]"
          }`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F8D9C9] text-base font-bold text-[#C2410C]">
              !
            </span>
            <div className="min-w-0">
              <div className="font-semibold">
                {unreadCrisisCount == null
                  ? "个案风险上报未读数量暂不可用"
                  : `个案风险上报未读 ${unreadCrisisCount} 条`}
              </div>
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
              {pageItems.map((item) => {
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
        {items.length > 0 && (
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={items.length}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        )}
      </div>
      {selectedMessage && (
        <MessageDetailDrawer
          actionTarget={selectedActionTarget}
          businessDetail={selectedBusinessDetail}
          loading={detailLoading}
          message={selectedMessage}
          onClose={onCloseDetail}
          onNavigateTarget={onNavigateTarget}
        />
      )}
    </section>
  );
}

function MessageDetailDrawer({
  actionTarget,
  businessDetail,
  loading,
  message,
  onClose,
  onNavigateTarget,
}: {
  actionTarget?: MessageActionTarget | null;
  businessDetail?: MessageBusinessDetail;
  loading?: boolean;
  message: MessageItem;
  onClose: () => void;
  onNavigateTarget?: (target: MessageActionTarget) => void;
}) {
  const display = getMessageDisplay(message);
  const detail = parseMessagePayload(message.Content)?.detail || {};
  const businessSections = buildMessageBusinessSections(businessDetail);
  const sections = [
    ...businessSections,
    ...buildMessageDetailSections(
      message,
      detail,
      display.summary,
      leaveBusinessStatus(businessDetail, message),
    ),
  ];
  const isCrisis = isCrisisReportMessage(message);
  const footer =
    actionTarget && onNavigateTarget ? (
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <button
          className="rounded-lg border border-[var(--lxxl-border)] px-5 py-2 text-sm font-medium text-[var(--lxxl-muted)]"
          type="button"
          onClick={onClose}
        >
          关闭
        </button>
        <button
          className="rounded-lg bg-[var(--lxxl-green)] px-5 py-2 text-sm font-medium text-white"
          type="button"
          onClick={() => onNavigateTarget(actionTarget)}
        >
          {actionTarget.label}
        </button>
      </div>
    ) : undefined;

  return (
    <DetailDrawer title={`${display.title}详情`} footer={footer} onClose={onClose}>
      <div className="space-y-6">
        {loading && (
          <div className="rounded-lg border border-[var(--lxxl-border)] bg-[#FAF8F4] px-4 py-3 text-sm text-[var(--lxxl-muted)]">
            正在加载最新消息详情...
          </div>
        )}
        {actionTarget && (
          <section className="border-b border-[var(--lxxl-border)] pb-5">
            <h4 className="text-sm font-semibold text-[var(--lxxl-text)]">后续处理</h4>
            <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">{actionTarget.description}</p>
          </section>
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

function buildMessageBusinessSections(businessDetail?: MessageBusinessDetail): DetailSection[] {
  if (!businessDetail) {
    return [];
  }
  if (businessDetail.error) {
    return [
      {
        title: "关联业务详情",
        rows: [{ label: "加载状态", value: businessDetail.error }],
      },
    ];
  }
  if (businessDetail.type !== "leave-request" || !businessDetail.data) {
    return [];
  }

  const data = businessDetail.data;
  const sections: DetailSection[] = [
    {
      title: "请假申请详情",
      rows: compactRows([
        { label: "咨询师", value: data.counselorName || "" },
        { label: "请假状态", value: statusLabel(data.status) },
        { label: "请假原因", value: data.reason || "" },
        { label: "咨询时间", value: timeRangeFromValues(data.startTime, data.endTime) },
        { label: "咨询地点", value: data.location || "" },
        { label: "提交时间", value: formatFullDateTime(data.createdAt) },
        { label: "拒绝理由", value: data.rejectReason || "" },
        { label: "审核人", value: data.reviewedBy ? `账号 #${data.reviewedBy}` : "" },
        { label: "处理时间", value: data.reviewedAt ? formatFullDateTime(data.reviewedAt) : "" },
        { label: "退款安排", value: leaveReviewOutcomeText(data.status) },
      ]),
    },
    {
      title: "受影响来访",
      rows: affectedLeavePatientRows(data.affectedPatients, data.status),
    },
  ];

  return sections.filter((section) => section.rows.length > 0);
}

function affectedLeavePatientRows(
  patients: AdminLeaveRequestDetail["affectedPatients"] = [],
  status = "PENDING",
) {
  return patients
    .map((patient, index) => {
      const patientName = formatPatientNameWithContractTag(
        patient.patientName,
        patient.patientContractTag,
      );
      const patientPhone = patient.patientPhone || "";
      const emergency =
        patient.emergencyContact && patient.emergencyPhone
          ? `${patient.emergencyContact}（${patient.emergencyPhone}）`
          : patient.emergencyContact || patient.emergencyPhone || "";
      return {
        label: `来访 ${index + 1}`,
        value: compactTextLines([
          patientName ? `来访者：${patientPhone ? `${patientName}（${patientPhone}）` : patientName}` : "",
          emergency ? `紧急联系人：${emergency}` : "",
          timeRangeFromValues(patient.startTime, patient.endTime)
            ? `咨询时间：${timeRangeFromValues(patient.startTime, patient.endTime)}`
            : "",
          patient.location ? `地点：${patient.location}` : "",
          `退款安排：${leaveRefundDisplayText(status, patient.refundText)}`,
        ]),
      };
    })
    .filter((row) => row.value);
}

function leaveReviewOutcomeText(status: string) {
  if (status === "APPROVED") {
    return "请假已通过，受影响预约已取消；已支付订单按原支付路径全额退款。";
  }
  if (status === "REJECTED") {
    return "请假未通过，预约与原支付状态保持不变。";
  }
  return "审核通过后将取消受影响预约，已支付订单将按原支付路径全额退款。";
}

function leaveRefundDisplayText(status: string, backendText?: string | null) {
  if (status === "PENDING") {
    return "审核通过后，已支付款项将按原支付路径全额退回";
  }
  if (status === "REJECTED") {
    return "请假未通过，预约与原支付状态保持不变";
  }
  if (status === "APPROVED") {
    return backendText?.includes("原路")
      ? "已支付款项已按原支付路径全额退回"
      : "本次预约无可退支付款项";
  }
  return backendText || "-";
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
  leaveStatus?: string,
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
        { label: "来访者", value: patientPersonText(detail) },
        { label: "时间", value: consultationTime },
        { label: "地点", value: location },
        { label: "请假原因", value: detailText(detail, "leaveReason") },
        {
          label: leaveStatus ? "退款安排" : "退款说明",
          value: leaveStatus
            ? leaveRefundDisplayText(leaveStatus, detailText(detail, "refundText"))
            : detailText(detail, "refundText"),
        },
        { label: "豁免申请", value: detailText(detail, "exemptionLabel") },
        { label: "摘要", value: summary },
      ]),
    },
    {
      title: "受影响预约",
      rows: affectedAppointmentRows(detail, leaveStatus),
    },
    {
      title: "补充字段",
      rows: extraDetailRows(detail),
    },
  ];

  return sections.filter((section) => section.rows.length > 0);
}

function leaveBusinessStatus(
  businessDetail: MessageBusinessDetail | undefined,
  message: MessageItem,
) {
  if (message.RelatedType !== "COUNSELOR_LEAVE") {
    return undefined;
  }
  if (businessDetail?.type === "leave-request" && businessDetail.data?.status) {
    return businessDetail.data.status;
  }
  if (message.Type === "COUNSELOR_LEAVE_SUCCESS") {
    return "APPROVED";
  }
  if (message.Type === "COUNSELOR_LEAVE_REJECTED") {
    return "REJECTED";
  }
  return "PENDING";
}

function compactRows(rows: DetailRow[]) {
  return rows.filter((row) => row.value && row.value !== "-");
}

function relatedBusinessText(message: MessageItem) {
  return relatedTypeLabel(message.RelatedType);
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
  return timeRangeFromValues(startTime, endTime);
}

function timeRangeFromValues(startTime?: string | null, endTime?: string | null) {
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

function patientPersonText(
  detail: Record<string, unknown>,
  nameKey = "patientName",
  phoneKey = "patientPhone",
  contractTagKey = "patientContractTag",
) {
  const name = formatPatientNameWithContractTag(
    detailText(detail, nameKey),
    detailText(detail, contractTagKey),
  );
  const phone = detailText(detail, phoneKey);
  if (!name) {
    return "";
  }
  return phone ? `${name}（${phone}）` : name;
}

function affectedAppointmentRows(detail: Record<string, unknown>, leaveStatus?: string) {
  const appointments = Array.isArray(detail.affectedAppointments) ? detail.affectedAppointments : [];
  return appointments
    .map((appointment, index) => {
      if (!appointment || typeof appointment !== "object" || Array.isArray(appointment)) {
        return null;
      }
      return {
        label: `预约 ${index + 1}`,
        value: affectedAppointmentText(appointment as Record<string, unknown>, leaveStatus),
      };
    })
    .filter((row): row is DetailRow => !!row && !!row.value);
}

function affectedAppointmentText(appointment: Record<string, unknown>, leaveStatus?: string) {
  const patient = patientPersonText(appointment) || detailText(appointment, "patientName");
  const emergency = personText(appointment, "emergencyContact", "emergencyPhone");
  const time = timeRangeText(appointment);
  const location = detailText(appointment, "location");
  const backendRefund = detailText(appointment, "refundText");
  const refund = leaveStatus
    ? leaveRefundDisplayText(leaveStatus, backendRefund)
    : backendRefund;
  const status = detailText(appointment, "orderStatus");
  return compactTextLines([
    patient ? `来访者：${patient}` : "",
    emergency ? `紧急联系人：${emergency}` : "",
    time ? `咨询时间：${time}` : "",
    location ? `地点：${location}` : "",
    refund ? `${leaveStatus ? "退款安排" : "退款说明"}：${refund}` : "",
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
  "patientContractTag",
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
  const patientContractTag = stringValue(detail.patientContractTag);
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
    const taggedPatientName = formatPatientNameWithContractTag(patientName, patientContractTag);
    rows.push({
      label: "来访者",
      value: patientPhone ? `${taggedPatientName}（${patientPhone}）` : taggedPatientName,
    });
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
    FEEDBACK: "咨询反馈",
    CONSULTATION: "咨询预约",
    SCHEDULE: "排期",
    COUNSELOR_LEAVE: "咨询师请假",
    APPOINTMENT_NEW: "新增预约",
    APPOINTMENT_CANCEL: "预约取消",
    COUNSELOR_APPOINTMENT_NEW: "新预约",
    COUNSELOR_APPOINTMENT_CANCEL: "预约取消",
    COUNSELOR_CONSULTATION_REMIND: "咨询提醒",
    COUNSELOR_LEAVE_SUBMITTED: "请假申请",
    COUNSELOR_LEAVE_SUCCESS: "请假结果",
    COUNSELOR_LEAVE_REJECTED: "请假未通过",
    COUNSELOR_CONSULTATION_DONE: "咨询完成",
    PATIENT_APPOINTMENT_SUCCESS: "预约成功",
    PATIENT_APPOINTMENT_CANCEL: "预约取消",
    PATIENT_LEAVE_APPROVED: "咨询师请假",
    PATIENT_NEW_ACTIVITY: "活动提醒",
    PATIENT_PROXY_ORDER_PENDING: "代理预约待支付",
    COUNSELOR_PROXY_ORDER_PENDING: "代理预约待支付",
    STAFF_PROXY_ORDER_PUSHED: "代理预约已推送",
    CHARITY_CONSULTATION_30_BOOKING: "公益咨询30次提示",
    CHARITY_CONSULTATION_30_DONE: "公益咨询30次提示",
    PROFESSIONAL_PAIR_CONSULTATION_30_BOOKING: "正价咨询30次提示",
    PRICING_COUNSELOR_BASE_UPDATED: "咨询师定价调整",
    PRICING_PATIENT_PRICE_UPDATED: "来访调价",
    PRICING_PATIENT_SHARE_UPDATED: "来访分成调整",
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
    .replace(/记录\s*#?\d+/g, "咨询记录")
    .replace(/排期\s*#?\d+/g, "排期")
    .replace(/咨询\s*#?\d+/g, "咨询")
    .replace(/_/g, " ");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
