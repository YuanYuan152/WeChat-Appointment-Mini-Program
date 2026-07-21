import type { Role } from "@/types/api";

export function formatMoneyFromCents(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "-";
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    timeZone: "Asia/Shanghai",
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function roleLabel(role?: Role | string | null) {
  const labels: Record<string, string> = {
    Patient: "来访者",
    Counselor: "咨询师",
    Assistant: "咨询助理",
    Ops: "咨询主任",
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
