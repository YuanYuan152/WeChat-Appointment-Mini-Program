"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { queryControlClass } from "@/components/ui";

const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minuteOptions = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

function parseTime(value: string) {
  const [hour, minute] = value.split(":");
  return {
    hour: hourOptions.includes(hour) ? hour : "09",
    minute: minuteOptions.includes(minute) ? minute : "00",
  };
}

function TimeOption({
  children,
  selected,
  onClick,
}: {
  children: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-9 w-full rounded-lg text-sm font-medium transition ${
        selected
          ? "bg-[var(--lxxl-green)] text-white shadow-sm"
          : "text-[var(--lxxl-text)] hover:bg-[#F4F1EB] hover:text-[var(--lxxl-green-dark)]"
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function TimePicker({
  value,
  onChange,
  placeholder = "默认时段",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseTime(value), [value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const displayValue = value || placeholder;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        aria-expanded={open}
        className={`${queryControlClass} flex items-center justify-between gap-3 text-left ${
          value ? "" : "text-[var(--lxxl-muted)]"
        }`}
        type="button"
        onClick={() => setOpen((next) => !next)}
      >
        <span>{displayValue}</span>
        <span className="grid h-6 w-6 place-items-center rounded-full border border-[var(--lxxl-border)] text-xs text-[var(--lxxl-muted)]">
          时
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-[280px] overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-[0_18px_45px_rgba(44,44,44,0.14)]">
          <div className="grid grid-cols-2 border-b border-[var(--lxxl-border)] bg-[#FAF8F4] px-3 py-2 text-xs font-medium text-[var(--lxxl-muted)]">
            <span>小时</span>
            <span>分钟</span>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {hourOptions.map((hour) => (
                <TimeOption
                  key={hour}
                  selected={parsed.hour === hour}
                  onClick={() => onChange(`${hour}:${parsed.minute}`)}
                >
                  {hour}
                </TimeOption>
              ))}
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {minuteOptions.map((minute) => (
                <TimeOption
                  key={minute}
                  selected={parsed.minute === minute}
                  onClick={() => onChange(`${parsed.hour}:${minute}`)}
                >
                  {minute}
                </TimeOption>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--lxxl-border)] px-3 py-2">
            <button
              className="text-xs font-medium text-[var(--lxxl-muted)] transition hover:text-[var(--lxxl-text)]"
              type="button"
              onClick={() => onChange("")}
            >
              清除
            </button>
            <button
              className="rounded-lg bg-[var(--lxxl-green)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--lxxl-green-dark)]"
              type="button"
              onClick={() => setOpen(false)}
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
