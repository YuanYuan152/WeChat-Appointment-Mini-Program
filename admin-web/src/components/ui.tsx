import type { ButtonHTMLAttributes, ReactNode } from "react";

import { PAGE_SIZE_OPTIONS } from "@/config/pagination";

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--lxxl-border)] px-6 py-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-[var(--lxxl-muted)]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="px-6 py-10 text-center text-sm text-[var(--lxxl-muted)]">{text}</div>;
}

export function TableActionButton({
  children,
  tone = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "primary" | "danger" | "muted";
}) {
  const styles = {
    primary: "text-[var(--lxxl-green)] hover:text-[var(--lxxl-green-dark)]",
    danger: "text-[#A13F37] hover:text-[#7F2F29]",
    muted: "text-[var(--lxxl-muted)] hover:text-[var(--lxxl-text)]",
  };

  return (
    <button
      className={`text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${styles[tone]} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export const queryControlClass =
  "h-10 w-full rounded-xl border border-[var(--lxxl-border)] bg-white px-3 text-sm text-[var(--lxxl-text)] outline-none transition placeholder:text-[var(--lxxl-muted)] focus:border-[var(--lxxl-green)]";

export function QueryField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-2 block text-xs font-medium text-[var(--lxxl-muted)]">{label}</span>
      {children}
    </label>
  );
}

export function QueryButton({
  children = "查询",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
}) {
  return (
    <button
      className={`h-10 w-24 shrink-0 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)] ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function QueryResetButton({
  children = "重置",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
}) {
  return (
    <button
      className={`h-10 w-24 shrink-0 rounded-xl border border-[var(--lxxl-border)] bg-white px-4 text-sm font-medium text-[var(--lxxl-muted)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)] ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "gold" | "red";
}) {
  const styles = {
    neutral: "bg-[#F4F1EB] text-[var(--lxxl-text)]",
    green: "bg-[#EAF2ED] text-[var(--lxxl-green-dark)]",
    gold: "bg-[#FBF3DF] text-[#967342]",
    red: "bg-[#FBE8E6] text-[#B34B43]",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#FAF8F4] p-3">
      <div className="text-xs text-[var(--lxxl-muted)]">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

export function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold">{title}</h4>
      {items.length === 0 ? (
        <div className="mt-3 text-sm text-[var(--lxxl-muted)]">暂无记录</div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <div
              key={`${title}-${index}`}
              className="rounded-xl bg-[#FAF8F4] p-3 text-xs leading-5 text-[var(--lxxl-muted)]"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
}) {
  const effectivePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / effectivePageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1;
  const end = Math.min(currentPage * effectivePageSize, total);
  const buttonClass =
    "rounded-xl border border-[var(--lxxl-border)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--lxxl-border)] px-5 py-4 text-sm">
      <div className="flex flex-wrap items-center gap-3 text-[var(--lxxl-muted)]">
        <span>
          共 {total} 条，显示 {start}-{end}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span>每页</span>
            <select
              className="h-9 rounded-xl border border-[var(--lxxl-border)] bg-white px-3 text-sm text-[var(--lxxl-text)] outline-none"
              value={effectivePageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span>条</span>
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          className={buttonClass}
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
        >
          首页
        </button>
        <button
          className={buttonClass}
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          上一页
        </button>
        <span className="min-w-24 text-center text-[var(--lxxl-muted)]">
          {currentPage} / {totalPages}
        </span>
        <button
          className={buttonClass}
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          下一页
        </button>
        <button
          className={buttonClass}
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          末页
        </button>
      </div>
    </div>
  );
}
