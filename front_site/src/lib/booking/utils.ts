const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000";

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}

export function billingToYuan(billingCents: number): number {
  return Math.round(Number(billingCents || 0) / 100) || 0;
}

export function splitCsv(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatSlotRange(start?: string | null, end?: string | null): string {
  if (!start) return "时间待定";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return start;
  const datePart = startDate.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const startTime = startDate.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (!end) return `${datePart} ${startTime}`;
  const endDate = new Date(end);
  const endTime = endDate.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart} ${startTime}-${endTime}`;
}

export function formatYuan(cents?: number | null): string {
  if (!cents) return "0";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export function consultationStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "待确认",
    CONFIRMED: "已确认",
    ONGOING: "进行中",
    DONE: "已完成",
    CANCELLED: "已取消",
  };
  return map[status] ?? status;
}

export function currentDateLabel(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}年${m}月${d}日`;
}
