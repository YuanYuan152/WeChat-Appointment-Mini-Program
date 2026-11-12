"use client";

import type { ReactNode } from "react";

import {
  FOLLOW_UP_META,
  RESPONDENT_STATUS_META,
  SEVERITY_META,
  UNGRADED_META,
} from "@/lib/enterpriseData";
import type { FollowUpStatus, RespondentStatus, Severity } from "@/types/enterpriseData";

export function DataCard({
  title,
  sub,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-xl border border-[var(--lxxl-border)] bg-white ${className}`}>
      {(title || right) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h3 className="text-base font-semibold text-[var(--lxxl-text)]">{title}</h3>}
            {sub && <p className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">{sub}</p>}
          </div>
          {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  unit,
  note,
  tone = "default",
  children,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  tone?: "default" | "risk" | "good";
  children?: ReactNode;
}) {
  const accent =
    tone === "risk" ? "border-t-[#B3261E]" : tone === "good" ? "border-t-[#2F7A55]" : "border-t-[var(--lxxl-green)]";
  const valueColor = tone === "risk" ? "text-[#B3261E]" : "text-[var(--lxxl-text)]";
  return (
    <div className={`rounded-xl border border-[var(--lxxl-border)] border-t-[3px] bg-white px-5 py-4 ${accent}`}>
      <div className="text-xs text-[var(--lxxl-muted)]">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-3xl font-semibold leading-none ${valueColor}`}>{value}</span>
        {unit && <span className="text-xs text-[var(--lxxl-muted)]">{unit}</span>}
      </div>
      {children}
      {note && <div className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">{note}</div>}
    </div>
  );
}

function Chip({ label, color, bg, size = "sm" }: { label: string; color: string; bg: string; size?: "xs" | "sm" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ${
        size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
      style={{ color, background: bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function SeverityChip({ severity, size }: { severity: Severity | null | undefined; size?: "xs" | "sm" }) {
  const meta = severity ? SEVERITY_META[severity] : UNGRADED_META;
  return <Chip bg={meta.bg} color={meta.color} label={meta.label} size={size} />;
}

export function FollowUpChip({ status, size }: { status: FollowUpStatus; size?: "xs" | "sm" }) {
  const meta = FOLLOW_UP_META[status];
  return <Chip bg={meta.bg} color={meta.color} label={meta.label} size={size} />;
}

export function StatusChip({ status, size }: { status: RespondentStatus; size?: "xs" | "sm" }) {
  const meta = RESPONDENT_STATUS_META[status];
  return <Chip bg={meta.bg} color={meta.color} label={meta.label} size={size} />;
}

export function TagChip({
  tag,
  color,
  onRemove,
}: {
  tag: string;
  color: string;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium"
      style={{ color, background: `${color}14` }}
    >
      {tag}
      {onRemove && (
        <button
          aria-label={`移除标签 ${tag}`}
          className="ml-0.5 leading-none opacity-70 hover:opacity-100"
          type="button"
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function ProgressBar({
  value,
  max = 100,
  color = "var(--lxxl-green)",
  height = 6,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="w-full overflow-hidden rounded-full bg-[#EFECE6]" style={{ height }}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${percent}%`, background: color }} />
    </div>
  );
}

export interface StackSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function StackedBar({ segments, height = 10 }: { segments: StackSegment[]; height?: number }) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return <div className="w-full rounded-full bg-[#EFECE6]" style={{ height }} />;
  }
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-[#EFECE6]" style={{ height }}>
      {segments
        .filter((item) => item.value > 0)
        .map((item) => (
          <div
            key={item.key}
            className="h-full"
            style={{ width: `${(item.value / total) * 100}%`, background: item.color }}
            title={`${item.label}：${item.value}`}
          />
        ))}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-xl bg-[#F4F1EB] p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              active ? "bg-white text-[var(--lxxl-green)] shadow-sm" : "text-[var(--lxxl-muted)] hover:text-[var(--lxxl-text)]"
            }`}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--lxxl-green)] transition hover:text-[var(--lxxl-green-dark)]"
      type="button"
      onClick={onClick}
    >
      {children}
      <span aria-hidden="true">›</span>
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
}) {
  const styles = {
    default:
      "border border-[var(--lxxl-border)] bg-white text-[var(--lxxl-text)] hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]",
    primary: "bg-[var(--lxxl-green)] text-white hover:bg-[var(--lxxl-green-dark)]",
    danger: "border border-[#F0B8B2] bg-white text-[#A13F37] hover:bg-[#FFF4F2]",
  };
  return (
    <button
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[tone]}`}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function EmptyHint({ text }: { text: string }) {
  return <div className="rounded-xl bg-[#FAF8F4] px-4 py-8 text-center text-sm text-[var(--lxxl-muted)]">{text}</div>;
}

export function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#D9E4DD] bg-[#F3F8F5] px-4 py-3 text-xs leading-6 text-[#3F5A4D]">
      <svg aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect height="11" rx="2" width="16" x="4" y="10" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
