"use client";

import type { ReactNode } from "react";

export function DetailDrawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="presentation">
      <aside
        aria-label={title}
        aria-modal="true"
        className="flex h-full w-full max-w-[520px] flex-col border-l border-[var(--lxxl-border)] bg-white shadow-2xl"
        role="dialog"
      >
        <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>
        <div className="flex justify-start border-t border-[var(--lxxl-border)] bg-white px-6 py-4">
          <button
            className="rounded-xl border border-[var(--lxxl-border)] px-4 py-2 text-sm font-medium text-[var(--lxxl-muted)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
            type="button"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      </aside>
    </div>
  );
}
