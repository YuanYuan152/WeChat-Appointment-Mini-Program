import type { Role } from "@/types/api";

const SHANGHAI_TIME_ZONE = "Asia/Shanghai";

/**
 * 解析管理端时间字符串。
 * - 带 Z / 偏移：按绝对时间解析，再格式化为北京时间
 * - 无时区 naive（FastAPI / SQL Server 常见）：按北京墙钟解释，避免浏览器本地时区漂移
 */
function parseAdminDateTime(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) {
    return new Date(Number.NaN);
  }
  if (/(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    return new Date(trimmed);
  }
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  return new Date(`${normalized}+08:00`);
}

function formatInShanghai(
  value: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = parseAdminDateTime(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    timeZone: SHANGHAI_TIME_ZONE,
    hour12: false,
    ...options,
  });
}

export function formatMoneyFromCents(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  if (value <= 0) {
    return "免费";
  }
  return `¥${(value / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  return formatInShanghai(value, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFullDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  return formatInShanghai(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 数据库 UTC naive 时间：补 Z 后再转为北京时间展示（测评完成时间、操作日志等） */
export function formatUtcFullDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  const normalizedValue = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    timeZone: SHANGHAI_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return formatInShanghai(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 意见反馈类型：历史 VARCHAR 写入可能变成 ???，统一兜底展示 */
export function feedbackCategoryLabel(category?: string | null) {
  const text = (category || "").trim();
  if (!text || /^[?？\uFFFD]+$/.test(text)) {
    return "其他";
  }
  return text;
}

export function roleLabel(role?: Role | string | null) {
  const labels: Record<string, string> = {
    Patient: "来访者",
    Counselor: "咨询师",
    Assistant: "咨询助理",
    Ops: "咨询主任",
    Tester: "测试员",
    Admin: "管理员",
  };
  return role ? labels[role] || role : "-";
}

export function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    PENDING: "待处理",
    PENDING_PAYMENT: "待支付",
    APPROVED: "已通过",
    REJECTED: "已拒绝",
    PAID: "已支付",
    REFUNDED: "已退款",
    DONE: "已完成",
    CREATED: "已创建",
    UPDATED: "已更新",
    CONFIRMED: "已确认",
    BOOKED: "已预约",
    AVAILABLE: "可用",
    MAINTENANCE: "维护中",
    DISABLED: "停用",
    IN_SESSION: "已预约",
    IDLE: "空闲",
    CANCELLED: "已取消",
    CANCELED: "已取消",
    OPEN: "未处理",
    ON_LEAVE: "已请假",
    CLOSED: "已处理",
    SUBMITTED: "已提交",
    ACTIVE: "启用",
    INACTIVE: "停用",
  };
  return status ? labels[status] || status : "-";
}
