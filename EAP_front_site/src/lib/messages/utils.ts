import type { MessageItem } from "@/lib/booking/types";

export interface MessagePayload {
  summary?: string;
  detail?: Record<string, unknown>;
}

export const PATIENT_MESSAGE_CATEGORIES = [
  { value: "ALL", label: "全部" },
  { value: "UNREAD", label: "未读" },
  { value: "appointment_success", label: "预约成功" },
  { value: "appointment_cancel", label: "预约取消" },
  { value: "appointment_remind", label: "预约提醒" },
  { value: "activity", label: "活动" },
  { value: "leave_notice", label: "请假通知" },
  { value: "exemption", label: "豁免结果" },
] as const;

const RELATED_TYPE_LABELS: Record<string, string> = {
  PATIENT_APPOINTMENT_SUCCESS: "预约成功",
  PATIENT_APPOINTMENT_CANCEL: "预约取消",
  PATIENT_APPOINTMENT_REMIND: "预约提醒",
  PATIENT_PROXY_ORDER_PENDING: "待支付预约",
  PATIENT_LEAVE_APPROVED: "请假通知",
  PATIENT_NEW_ACTIVITY: "新活动",
  REFUND_EXEMPTION: "退款豁免",
  REFUND_EXEMPTION_PENDING: "豁免待审核",
};

export function parseMessageContent(content?: string | null): MessagePayload {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content) as MessagePayload;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* 兼容纯文本 */
  }
  return { summary: content };
}

export function messageDisplayTitle(item: MessageItem): string {
  const rt = item.relatedType || "";
  if (rt === "REFUND_EXEMPTION") {
    const detail = parseMessageContent(item.content).detail;
    if (detail?.status === "APPROVED" || detail?.approved === true) return "豁免申请已通过";
    if (detail?.status === "REJECTED" || detail?.approved === false) return "豁免申请未通过";
    if ((item.title || "").includes("待审核")) return "豁免申请待审核";
  }
  return item.title || "消息";
}

export function messageSummary(item: MessageItem): string {
  const payload = parseMessageContent(item.content);
  return payload.summary || item.content || "暂无详情";
}

export function messageCategoryLabel(item: MessageItem): string {
  const rt = item.relatedType || "";
  if (RELATED_TYPE_LABELS[rt]) return RELATED_TYPE_LABELS[rt];
  return item.type || "消息";
}

export function formatMessageTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function resolvePatientMessageLink(item: MessageItem): string | null {
  const rt = item.relatedType || "";
  if (rt === "PATIENT_PROXY_ORDER_PENDING") {
    return "/consultation/records";
  }
  if (
    rt === "PATIENT_APPOINTMENT_SUCCESS" ||
    rt === "PATIENT_APPOINTMENT_CANCEL" ||
    rt === "PATIENT_APPOINTMENT_REMIND" ||
    rt === "PATIENT_LEAVE_APPROVED" ||
    rt === "REFUND_EXEMPTION" ||
    rt === "REFUND_EXEMPTION_PENDING"
  ) {
    return "/consultation/records";
  }
  return null;
}
